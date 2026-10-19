"use server";

import { FIELD_MAX_LENGTHS, SERVICE_AREA_ZIPS, TIME_SLOT_WINDOWS } from "@/lib/constants";
import { looksLikeBot, type BotCheck } from "@/lib/bot-check";
import { allowPublicSubmission } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireAdmin, type AdminContext } from "@/lib/supabase/require-admin";
import { isNyWallClockInFuture, isValidDateStr, nyWallClockToInstant } from "@/lib/datetime";

export interface BookingData {
  service: string;
  frequency: string;
  address: string;
  city: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  notes: string;
  date: string;
  timeSlot: string;
  name: string;
  email: string;
  phone: string;
  // Entry instructions (door code, gate, pets). Public form only: the admin
  // New Booking form has no such field, and adminCreateBooking refuses them.
  // Stored in booking_access, never in notes, and never logged.
  accessInstructions?: string;
}

export interface BookingResult {
  success: boolean;
  bookingRef?: string;
  bookingId?: string;
  error?: string;
  // Set only when the booking could not be stored (the database was unreachable
  // or refused the insert), so the form can show the "service unavailable"
  // screen instead of a message about the customer's input.
  unavailable?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
const VALID_SERVICES = ["standard", "deep", "moveinout"];
const VALID_FREQUENCIES = ["one-time", "weekly", "bi-weekly", "monthly"];
const VALID_TIME_SLOTS = Object.keys(TIME_SLOT_WINDOWS);

const STRING_FIELDS = [
  "service", "frequency", "address", "city", "zip", "notes", "date", "timeSlot", "name", "email", "phone",
] as const;

const LENGTH_LIMITED_FIELDS: [keyof typeof FIELD_MAX_LENGTHS & keyof BookingData, string][] = [
  ["name", "Name"],
  ["email", "Email address"],
  ["phone", "Phone number"],
  ["address", "Address"],
  ["city", "City"],
  ["notes", "Special instructions"],
  ["accessInstructions", "Entry instructions"],
];

// Server Action arguments come straight from the caller: the BookingData type
// is not enforced at runtime, so a script can send anything.
function hasBookingShape(data: unknown): data is BookingData {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    STRING_FIELDS.every((field) => typeof record[field] === "string") &&
    (record.accessInstructions === undefined || typeof record.accessInstructions === "string") &&
    Number.isInteger(record.bedrooms) &&
    Number.isInteger(record.bathrooms)
  );
}

// Log only the Postgres error code plus a correlation id — full Supabase
// error objects can echo the submitted row (customer PII) into server logs.
function logDbError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

// The service-role client (public path) and an admin's session client (admin
// path) share this shape; only the privileges behind them differ.
type BookingClient = AdminContext["supabase"];

interface BookingPath {
  logLabel: string;
  activityDescription: string;
  // Public path only: the per-IP allowance. Admins are never rate-limited.
  rateLimited: boolean;
  // Public path only. If the booking_access insert fails the booking is
  // deleted again, and an admin session has no DELETE on bookings, so the
  // admin path couldn't roll back. Admins add entry instructions on the
  // booking's page instead (set_booking_access).
  acceptsAccessInstructions: boolean;
  // Called once validation has passed. Public: the service role, the only
  // insert path for signed-out customers. Admin: the admin's own session, so
  // RLS applies.
  client: () => BookingClient;
}

// Shared by submitBooking and adminCreateBooking so validation and insert
// logic can't drift between the client and admin paths.
async function createBooking(data: BookingData, path: BookingPath): Promise<BookingResult> {
  const { logLabel, activityDescription } = path;

  // Server-side validation
  if (!hasBookingShape(data)) {
    return { success: false, error: "Invalid booking details." };
  }

  for (const [field, label] of LENGTH_LIMITED_FIELDS) {
    const max = FIELD_MAX_LENGTHS[field];
    if ((data[field] ?? "").length > max) {
      return { success: false, error: `${label} must be ${max} characters or fewer.` };
    }
  }

  if (!path.acceptsAccessInstructions && data.accessInstructions?.trim()) {
    return { success: false, error: "Add entry instructions from the booking's page." };
  }

  if (!VALID_SERVICES.includes(data.service)) {
    return { success: false, error: "Invalid service type." };
  }

  if (!VALID_FREQUENCIES.includes(data.frequency)) {
    return { success: false, error: "Invalid frequency." };
  }

  if (!data.address.trim() || !data.city.trim()) {
    return { success: false, error: "Address and city are required." };
  }

  if (!/^\d{5}$/.test(data.zip.trim())) {
    return { success: false, error: "Invalid ZIP code." };
  }

  if (!SERVICE_AREA_ZIPS.includes(data.zip.trim())) {
    return { success: false, error: "We don't currently serve this area." };
  }

  if (data.bedrooms < 1 || data.bedrooms > 5 || data.bathrooms < 1 || data.bathrooms > 5) {
    return { success: false, error: "Bedroom and bathroom count must be between 1 and 5." };
  }

  // Reject empty/malformed/impossible dates before they reach the date math
  // below, where an Invalid Date would throw at .toISOString().
  if (!isValidDateStr(data.date)) {
    return { success: false, error: "Please choose a valid date." };
  }

  if (!VALID_TIME_SLOTS.includes(data.timeSlot)) {
    return { success: false, error: "Invalid time slot." };
  }

  // No past dates and same-day cutoff: the chosen slot must still be in the
  // future in New York, so booking this morning's slot at 5 PM is rejected.
  // The date is valid and the slot is known here, so the lookup is safe.
  const window = TIME_SLOT_WINDOWS[data.timeSlot as keyof typeof TIME_SLOT_WINDOWS];
  if (!isNyWallClockInFuture(data.date, window.start)) {
    return {
      success: false,
      error: "That time has already passed. Please choose a later date or time.",
    };
  }

  if (!data.name.trim()) {
    return { success: false, error: "Name is required." };
  }

  if (!EMAIL_REGEX.test(data.email.trim())) {
    return { success: false, error: "Invalid email address." };
  }

  if (!PHONE_REGEX.test(data.phone.trim())) {
    return { success: false, error: "Invalid phone number." };
  }

  // Counted after validation, so only requests that would insert a row use up
  // the caller's allowance.
  if (path.rateLimited && !(await allowPublicSubmission("booking"))) {
    return {
      success: false,
      error:
        "We've received several booking requests from your connection. Please try again in about an hour.",
    };
  }

  // The slot window (looked up above) is New York wall-clock time. Convert to a
  // UTC instant via the NY zone (not the server's local zone) so start_at/end_at
  // are correct no matter where the process runs, and correct across DST.
  const startAt = nyWallClockToInstant(data.date, window.start);
  const endAt = nyWallClockToInstant(data.date, window.end);

  const supabase = path.client();

  const { data: booking, error: insertError } = await supabase
    .from("bookings")
    .insert({
      client_name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      service_type: data.service as "standard" | "deep" | "moveinout",
      frequency: data.frequency as "one-time" | "weekly" | "bi-weekly" | "monthly",
      address: data.address.trim(),
      city: data.city.trim(),
      zip: data.zip.trim(),
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      notes: data.notes.trim() || null,
      scheduled_date: data.date,
      time_slot: data.timeSlot as "morning" | "afternoon",
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
    })
    .select("id, booking_number")
    .single();

  if (insertError || !booking) {
    logDbError(`${logLabel}: insert`, insertError);
    return { success: false, error: "Something went wrong. Please try again.", unavailable: true };
  }

  // A separate, admin-only table (booking_access), so list and calendar
  // queries on bookings can never pick the instructions up. If they can't be
  // stored, the booking is taken back out: the customer is told to try again
  // rather than having a cleaner turn up without the door code.
  const accessInstructions = data.accessInstructions?.trim();
  if (accessInstructions) {
    const { error: accessError } = await supabase
      .from("booking_access")
      .insert({ booking_id: booking.id, instructions: accessInstructions });

    if (accessError) {
      logDbError(`${logLabel}: access insert`, accessError);
      const { error: rollbackError } = await supabase
        .from("bookings")
        .delete()
        .eq("id", booking.id);
      if (rollbackError) logDbError(`${logLabel}: rollback`, rollbackError);
      return { success: false, error: "Something went wrong. Please try again.", unavailable: true };
    }
  }

  const { error: activityError } = await supabase.from("activity_log").insert({
    booking_id: booking.id,
    description: activityDescription,
  });

  if (activityError) {
    logDbError(`${logLabel}: activity log insert`, activityError);
  }

  return {
    success: true,
    bookingRef: `AOC-${booking.booking_number}`,
    bookingId: booking.id,
  };
}

export async function submitBooking(data: BookingData, botCheck: BotCheck): Promise<BookingResult> {
  // First, and answered exactly like a failed insert (same error, same
  // `unavailable` flag) so a bot learns nothing. Nothing is logged: the payload
  // is the bot's, not ours to keep.
  if (looksLikeBot(botCheck)) {
    return { success: false, error: "Something went wrong. Please try again.", unavailable: true };
  }
  return createBooking(data, {
    logLabel: "submitBooking",
    activityDescription: "Booking submitted by client",
    rateLimited: true,
    acceptsAccessInstructions: true,
    client: createServiceRoleClient,
  });
}

/**
 * Admin-initiated booking — same validation, different activity log message.
 * Writes through the admin's own session (admin-only insert policies), never
 * the service role. The actor's email comes from the verified session, never
 * from the caller.
 */
export async function adminCreateBooking(data: BookingData): Promise<BookingResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  return createBooking(data, {
    logLabel: "adminCreateBooking",
    activityDescription: `Booking created by ${auth.user.email ?? "admin"}`,
    rateLimited: false,
    acceptsAccessInstructions: false,
    client: () => auth.supabase,
  });
}
