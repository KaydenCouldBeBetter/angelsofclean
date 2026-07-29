"use server";

import { SERVICE_AREA_ZIPS } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/service";

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
const VALID_TIME_SLOTS = ["morning", "afternoon"];

// Customers pick a slot, not an exact time — fixed windows until Reschedule
// (which would need a real time picker) is in scope.
const TIME_SLOT_WINDOWS: Record<string, { start: string; end: string }> = {
  morning: { start: "09:00:00", end: "11:00:00" },
  afternoon: { start: "13:00:00", end: "15:00:00" },
};

export async function submitBooking(data: BookingData): Promise<BookingResult> {
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

  const window = TIME_SLOT_WINDOWS[data.timeSlot];
  const startAt = new Date(`${data.date}T${window.start}`);
  const endAt = new Date(`${data.date}T${window.end}`);

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
    console.error("submitBooking: insert failed", insertError);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  const { error: activityError } = await supabase.from("activity_log").insert({
    booking_id: booking.id,
    description: "Booking submitted by client",
  });

  if (activityError) {
    console.error("submitBooking: activity log insert failed", activityError);
  }

  return {
    success: true,
    bookingRef: `AOC-${booking.booking_number}`,
    bookingId: booking.id,
  };
}

/** Admin-initiated booking — same validation, different activity log message. */
export async function adminCreateBooking(
  data: BookingData,
  adminEmail: string,
): Promise<BookingResult> {
  // Reuse all validation
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

  const window = TIME_SLOT_WINDOWS[data.timeSlot];
  const startAt = new Date(`${data.date}T${window.start}`);
  const endAt = new Date(`${data.date}T${window.end}`);

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
    console.error("adminCreateBooking: insert failed", insertError);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  await supabase.from("activity_log").insert({
    booking_id: booking.id,
    description: `Booking created by ${adminEmail}`,
  });

  return {
    success: true,
    bookingRef: `AOC-${booking.booking_number}`,
    bookingId: booking.id,
  };
}
