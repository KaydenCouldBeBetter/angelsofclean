"use server";

import { SERVICE_AREA_ZIPS, TIME_SLOT_WINDOWS } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { nyWallClockToInstant } from "@/lib/datetime";

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
}

export interface BookingResult {
  success: boolean;
  bookingRef?: string;
  bookingId?: string;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
const VALID_SERVICES = ["standard", "deep", "moveinout"];
const VALID_FREQUENCIES = ["one-time", "weekly", "bi-weekly", "monthly"];
const VALID_TIME_SLOTS = Object.keys(TIME_SLOT_WINDOWS);

// Log only the Postgres error code plus a correlation id — full Supabase
// error objects can echo the submitted row (customer PII) into server logs.
function logDbError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

// Shared by submitBooking and adminCreateBooking so validation and insert
// logic can't drift between the client and admin paths.
async function createBooking(
  data: BookingData,
  logLabel: string,
  activityDescription: string,
): Promise<BookingResult> {
  // Server-side validation
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

  if (!data.date) {
    return { success: false, error: "Date is required." };
  }

  if (!VALID_TIME_SLOTS.includes(data.timeSlot)) {
    return { success: false, error: "Invalid time slot." };
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

  // The slot window is New York wall-clock time. Convert to a UTC instant via
  // the NY zone (not the server's local zone) so start_at/end_at are correct
  // no matter where the process runs, and correct across DST.
  const window = TIME_SLOT_WINDOWS[data.timeSlot as keyof typeof TIME_SLOT_WINDOWS];
  const startAt = nyWallClockToInstant(data.date, window.start);
  const endAt = nyWallClockToInstant(data.date, window.end);

  const supabase = createServiceRoleClient();

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
    return { success: false, error: "Something went wrong. Please try again." };
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

export async function submitBooking(data: BookingData): Promise<BookingResult> {
  return createBooking(data, "submitBooking", "Booking submitted by client");
}

/**
 * Admin-initiated booking — same validation, different activity log message.
 * The actor's email comes from the verified session, never from the caller.
 */
export async function adminCreateBooking(data: BookingData): Promise<BookingResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  return createBooking(
    data,
    "adminCreateBooking",
    `Booking created by ${auth.user.email ?? "admin"}`,
  );
}
