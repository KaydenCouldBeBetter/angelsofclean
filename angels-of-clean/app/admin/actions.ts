"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

function revalidateBookingPaths(bookingId: string) {
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/employees");
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bookingId: string,
  description: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const suffix = user?.email ? ` by ${user.email}` : "";
  await supabase.from("activity_log").insert({
    booking_id: bookingId,
    description: `${description}${suffix}`,
  });
}

export async function assignEmployees(
  bookingId: string,
  employeeIds: string[],
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("booking_employees")
    .delete()
    .eq("booking_id", bookingId);

  if (deleteError) {
    console.error("assignEmployees: delete failed", deleteError);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  if (employeeIds.length > 0) {
    const { error: insertError } = await supabase
      .from("booking_employees")
      .insert(employeeIds.map((employee_id) => ({ booking_id: bookingId, employee_id })));

    if (insertError) {
      console.error("assignEmployees: insert failed", insertError);
      return { success: false, error: "Something went wrong. Please try again." };
    }
  }

  const description = employeeIds.length > 0
    ? `Employee${employeeIds.length > 1 ? "s" : ""} assigned`
    : "Employees unassigned";
  await logActivity(supabase, bookingId, description);

  revalidateBookingPaths(bookingId);
  return { success: true };
}

export async function updateBookingStatus(
  bookingId: string,
  status: JobStatus,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (error) {
    console.error("updateBookingStatus failed", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  await logActivity(supabase, bookingId, STATUS_ACTIVITY_LABEL[status]);

  revalidateBookingPaths(bookingId);
  return { success: true };
}
