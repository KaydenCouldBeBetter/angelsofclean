"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type AdminContext } from "@/lib/supabase/require-admin";
import type { JobStatus } from "@/lib/admin-types";
import type { AssignmentConflictRow } from "@/lib/supabase/types";
import { formatNy, formatNyTimeRange } from "@/lib/datetime";

interface ActionResult {
  success: boolean;
  error?: string;
}

const STATUS_ACTIVITY_LABEL: Record<JobStatus, string> = {
  pending: "Marked pending",
  confirmed: "Confirmed",
  active: "Marked in progress",
  done: "Marked complete",
  cancelled: "Booking cancelled",
};

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

export async function confirmBooking(bookingId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase } = auth;

  // The status filter makes pending → confirmed atomic: a booking that was
  // cancelled or completed since the page loaded matches zero rows instead of
  // being silently brought back.
  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "pending")
    .select("id");

  if (error) {
    logDbError("confirmBooking", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  if (!updated || updated.length === 0) {
    // Refresh the admin pages so the admin sees what the booking is now.
    revalidateBookingPaths(bookingId);
    return {
      success: false,
      error: "This booking is no longer pending, so it can't be confirmed.",
    };
  }

  await logActivity(auth, bookingId, STATUS_ACTIVITY_LABEL.confirmed);

  revalidateBookingPaths(bookingId);
  return { success: true };
}

export async function updateBookingStatus(
  bookingId: string,
  status: JobStatus,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase } = auth;

  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .select("id");

  if (error) {
    logDbError("updateBookingStatus", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  // Zero affected rows means the booking doesn't exist (or RLS blocked the
  // write) — without .select() Supabase reports that as a silent success.
  if (!updated || updated.length === 0) {
    return { success: false, error: "Booking not found." };
  }

  await logActivity(auth, bookingId, STATUS_ACTIVITY_LABEL[status]);

  revalidateBookingPaths(bookingId);
  return { success: true };
}
