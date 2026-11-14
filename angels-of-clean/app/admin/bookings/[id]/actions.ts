"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { isUuid } from "@/lib/admin-customers";
import { isHomeSize } from "@/lib/home-size";

export interface EntryInstructionsResult {
  success: boolean;
  error?: string;
}

// Log only the Postgres error code plus a correlation id — never the
// instructions themselves.
function logDbError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

/**
 * Saves a booking's entry instructions (door code, gate, pets), or removes
 * them when blank. set_booking_access
 * (supabase/migrations/20261019152751_booking_access.sql) writes booking_access
 * and an activity entry that says only that they changed, in one transaction.
 */
export async function updateEntryInstructions(
  bookingId: string,
  instructions: string,
): Promise<EntryInstructionsResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  if (typeof bookingId !== "string" || typeof instructions !== "string") {
    return { success: false, error: "Invalid entry instructions." };
  }

  const max = FIELD_MAX_LENGTHS.accessInstructions;
  if (instructions.length > max) {
    return { success: false, error: `Entry instructions must be ${max} characters or fewer.` };
  }

  const { data, error } = await auth.supabase.rpc("set_booking_access", {
    p_booking_id: bookingId,
    p_instructions: instructions.trim(),
  });

  if (error || !data) {
    logDbError("updateEntryInstructions", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  if (data.status === "not_found") {
    return { success: false, error: "This booking no longer exists." };
  }

  // Only the detail page shows them; the list and calendar never do.
  if (data.status !== "unchanged") revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

export interface HomeSizeResult {
  success: boolean;
  error?: string;
}

/**
 * Corrects a booking's home size (a customer who said "Not sure", or got it
 * wrong). set_booking_home_size (supabase/migrations/20261113221252_booking_home_size.sql)
 * saves it and writes an activity entry in one transaction, and refuses a
 * booking that is finished or cancelled.
 */
export async function updateHomeSize(bookingId: unknown, homeSize: unknown): Promise<HomeSizeResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  if (typeof bookingId !== "string" || !isUuid(bookingId) || !isHomeSize(homeSize)) {
    return { success: false, error: "Choose a home size from the list." };
  }

  const { data, error } = await auth.supabase.rpc("set_booking_home_size", {
    p_booking_id: bookingId,
    p_home_size: homeSize,
  });

  if (error || !data) {
    logDbError("updateHomeSize", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  switch (data.status) {
    case "not_found":
      return { success: false, error: "This booking no longer exists." };
    case "closed":
      return { success: false, error: "A finished or cancelled booking's size can't be changed." };
    case "unchanged":
      return { success: true };
    case "saved":
      revalidatePath(`/admin/bookings/${bookingId}`);
      return { success: true };
  }
}
