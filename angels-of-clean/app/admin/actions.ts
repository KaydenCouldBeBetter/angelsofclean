"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type AdminContext } from "@/lib/supabase/require-admin";
import type { JobStatus } from "./data/mock";

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

export async function assignEmployees(
  bookingId: string,
  employeeIds: string[],
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase } = auth;

  const { error: deleteError } = await supabase
    .from("booking_employees")
    .delete()
    .eq("booking_id", bookingId);

  if (deleteError) {
    logDbError("assignEmployees: delete", deleteError);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  if (employeeIds.length > 0) {
    const { error: insertError } = await supabase
      .from("booking_employees")
      .insert(employeeIds.map((employee_id) => ({ booking_id: bookingId, employee_id })));

    if (insertError) {
      logDbError("assignEmployees: insert", insertError);
      return { success: false, error: "Something went wrong. Please try again." };
    }
  }

  const description = employeeIds.length > 0
    ? `Employee${employeeIds.length > 1 ? "s" : ""} assigned`
    : "Employees unassigned";
  await logActivity(auth, bookingId, description);

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
