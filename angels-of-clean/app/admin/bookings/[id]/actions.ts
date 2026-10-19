"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";

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
