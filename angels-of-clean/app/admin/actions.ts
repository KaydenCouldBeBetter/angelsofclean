"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type AdminContext } from "@/lib/supabase/require-admin";
import type { JobStatus } from "@/lib/admin-types";
import type { AssignmentConflictRow } from "@/lib/supabase/types";
import { formatNy, formatNyTimeRange } from "@/lib/datetime";
import {
  DASHBOARD_STATUS,
  STATUS_ACTIVITY_LABEL,
  type StatusChangeTarget,
} from "./status-config";

interface ActionResult {
  success: boolean;
  error?: string;
}

// Log only the Postgres error code plus a correlation id — full Supabase
// error objects can echo row data (customer PII) into server logs.
function logDbError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

function revalidateBookingPaths(bookingId: string) {
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/employees");
}

async function logActivity(
  { supabase, user }: AdminContext,
  bookingId: string,
  description: string,
) {
  const suffix = user.email ? ` by ${user.email}` : "";
  await supabase.from("activity_log").insert({
    booking_id: bookingId,
    description: `${description}${suffix}`,
  });
}

// A failed assignment either carries an error, or (when the only problem is
// overlapping jobs) the overlaps to show the admin before "Assign anyway".
export type AssignResult =
  | { success: true }
  | { success: false; error: string; conflicts?: never }
  | { success: false; conflicts: string[]; error?: never };

const listFormat = new Intl.ListFormat("en-US", { style: "long", type: "conjunction" });

// "Marcus T. is already on #1042 (Tue, Oct 20, 8:00 AM – 12:00 PM)."
function describeConflict(c: AssignmentConflictRow): string {
  const day = formatNy(c.start_at, { weekday: "short", month: "short", day: "numeric" });
  return `${c.employee_name} is already on #${c.booking_number} (${day}, ${formatNyTimeRange(c.start_at, c.end_at)}).`;
}

// "Assigned Marcus T.; unassigned Rosa C. (overlap with #1042 overridden)"
function describeCrewChange(
  added: string[],
  removed: string[],
  overridden: AssignmentConflictRow[],
): string | null {
  const parts: string[] = [];
  if (added.length > 0) parts.push(`assigned ${listFormat.format(added)}`);
  if (removed.length > 0) parts.push(`unassigned ${listFormat.format(removed)}`);
  if (parts.length === 0) return null;

  let description = parts.join("; ");
  description = description[0].toUpperCase() + description.slice(1);

  const numbers = [...new Set(overridden.map((c) => `#${c.booking_number}`))];
  if (numbers.length > 0) {
    description += ` (overlap with ${listFormat.format(numbers)} overridden)`;
  }
  return description;
}

/**
 * Replaces a booking's crew in one database transaction (supabase/006).
 * `expectedEmployeeIds` is the crew the admin saw when the page loaded; if it
 * changed since, nothing is saved. Newly added cleaners who are already on an
 * overlapping job come back as `conflicts` unless `allowOverlap` is set.
 */
export async function assignEmployees(
  bookingId: string,
  employeeIds: string[],
  expectedEmployeeIds: string[],
  { allowOverlap = false }: { allowOverlap?: boolean } = {},
): Promise<AssignResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase } = auth;

  const { data: result, error } = await supabase.rpc("assign_booking_employees", {
    p_booking_id: bookingId,
    p_employee_ids: employeeIds,
    p_expected_employee_ids: expectedEmployeeIds,
    p_allow_overlap: allowOverlap === true,
  });

  if (error || !result) {
    logDbError("assignEmployees", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  switch (result.status) {
    case "not_found":
      return { success: false, error: "Booking not found." };

    case "closed":
      revalidateBookingPaths(bookingId);
      return {
        success: false,
        error: `This booking is ${result.booking_status === "done" ? "completed" : "cancelled"}, so its crew can't be changed.`,
      };

    case "stale":
      revalidateBookingPaths(bookingId);
      return {
        success: false,
        error: "Someone else changed this crew since you opened the page. Check the current crew and try again.",
      };

    case "conflicts":
      return { success: false, conflicts: result.conflicts.map(describeConflict) };

    case "saved": {
      const description = describeCrewChange(result.added, result.removed, result.overridden);
      if (description) await logActivity(auth, bookingId, description);
      revalidateBookingPaths(bookingId);
      return { success: true };
    }
  }
}

function statusName(status: JobStatus): string {
  return DASHBOARD_STATUS[status].label.toLowerCase();
}

// Why set_booking_status refused, given the status the booking really has.
function refusalMessage(current: JobStatus, target: StatusChangeTarget): string {
  if (current === "done" || current === "cancelled") {
    return `This booking is ${current === "done" ? "completed" : "cancelled"}, so its status can't be changed.`;
  }
  if (current === target) return `This booking is already ${statusName(current)}.`;
  if (target === "confirmed") return "This booking is no longer pending, so it can't be confirmed.";
  return `This booking is ${statusName(current)}, so it can't be marked ${statusName(target)}.`;
}

/**
 * Changes a booking's status and writes its activity entry in one database
 * transaction and one round trip
 * (supabase/migrations/20261019035418_booking_status_flow.sql).
 * Postgres decides whether the move is allowed (see STATUS_TRANSITIONS) and
 * records the admin's email from their session token.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: StatusChangeTarget,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase } = auth;

  // Server actions take whatever the client sends; only real targets reach
  // the database.
  if (!Object.hasOwn(STATUS_ACTIVITY_LABEL, status)) {
    return { success: false, error: "That status change isn't allowed." };
  }

  const { data: result, error } = await supabase.rpc("set_booking_status", {
    p_booking_id: bookingId,
    p_status: status,
    p_description: STATUS_ACTIVITY_LABEL[status],
  });

  if (error || !result) {
    logDbError("updateBookingStatus", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  switch (result.status) {
    case "not_found":
      return { success: false, error: "Booking not found." };

    case "refused":
      // Refresh the admin pages so the admin sees what the booking is now.
      revalidateBookingPaths(bookingId);
      return { success: false, error: refusalMessage(result.booking_status, status) };

    case "changed":
      revalidateBookingPaths(bookingId);
      return { success: true };
  }
}

export async function confirmBooking(bookingId: string): Promise<ActionResult> {
  return updateBookingStatus(bookingId, "confirmed");
}
