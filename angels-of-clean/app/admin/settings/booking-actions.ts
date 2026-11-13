"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { countBookingsOnDate } from "@/lib/supabase/booking-settings";
import { validateBlackoutInput, validateBookingSettings } from "@/lib/booking-rules";
import { isValidDateStr } from "@/lib/datetime";

// Online booking controls (Settings page). They are shared by every admin and
// change what customers can book, so each action checks the admin role first
// (server actions are directly callable), validates before writing, and writes
// through the SECURITY DEFINER functions in 20261113205039_booking_controls.sql,
// which check the admin claim again and record the change in the audit trail.
// The public booking flow reads the result within about 30 seconds (the rules
// route is cached) and submitBooking enforces it at once.

export type BookingControlsResult = { success: true } | { success: false; error: string };
export type BlackoutPreviewResult = { success: true; bookings: number } | { success: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";
const fail = (error: string): { success: false; error: string } => ({ success: false, error });

// Log only the Postgres error code plus a correlation id, never the row.
function logDbError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

function revalidateControls() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
}

/** Saves the pause, its message, the minimum notice and how far ahead customers can book. */
export async function saveBookingSettings(raw: unknown): Promise<BookingControlsResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const parsed = validateBookingSettings(raw);
  if (!parsed.ok) return fail(parsed.error);
  const settings = parsed.value;

  const { data, error } = await auth.supabase.rpc("save_booking_settings", {
    p_paused: settings.paused,
    p_pause_message: settings.pauseMessage,
    p_min_notice_hours: settings.minNoticeHours,
    p_max_days_ahead: settings.maxDaysAhead,
  });
  if (error || !data) {
    logDbError("saveBookingSettings", error);
    return fail(GENERIC_ERROR);
  }

  // "unchanged" is a success too: the page already shows what was asked for.
  revalidateControls();
  return { success: true };
}

/** Closes one whole day to customers. Bookings already on it are left alone. */
export async function addBlackoutDate(raw: unknown): Promise<BookingControlsResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const parsed = validateBlackoutInput(raw);
  if (!parsed.ok) return fail(parsed.error);

  const { data, error } = await auth.supabase.rpc("add_blackout_date", {
    p_day: parsed.value.day,
    p_label: parsed.value.label,
  });
  if (error || !data) {
    logDbError("addBlackoutDate", error);
    return fail(GENERIC_ERROR);
  }

  switch (data.status) {
    case "added":
      revalidateControls();
      return { success: true };
    case "exists":
      return fail("That date is already closed.");
    case "past":
      return fail("That date has already passed.");
    case "too_far":
      return fail("Choose a date within the next two years.");
  }
}

/** Reopens a closed day. Reopening one that is already open is not an error. */
export async function removeBlackoutDate(day: unknown): Promise<BookingControlsResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (typeof day !== "string" || !isValidDateStr(day)) return fail("Choose a valid date.");

  const { data, error } = await auth.supabase.rpc("remove_blackout_date", { p_day: day });
  if (error || !data) {
    logDbError("removeBlackoutDate", error);
    return fail(GENERIC_ERROR);
  }

  revalidateControls();
  return { success: true };
}

/** How many bookings a day already has, so an admin sees what closing it leaves in place. */
export async function previewBlackoutDate(day: unknown): Promise<BlackoutPreviewResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (typeof day !== "string" || !isValidDateStr(day)) return fail("Choose a valid date.");

  const count = await countBookingsOnDate(auth.supabase, day);
  if (!count.ok) return fail(GENERIC_ERROR);
  return { success: true, bookings: count.data };
}
