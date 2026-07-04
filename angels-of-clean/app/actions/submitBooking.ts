"use server";

import { SERVICE_AREA_ZIPS } from "@/lib/constants";

interface BookingData {
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

interface BookingResult {
  success: boolean;
  bookingRef?: string;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
const VALID_SERVICES = ["standard", "deep", "moveinout"];
const VALID_FREQUENCIES = ["one-time", "weekly", "bi-weekly", "monthly"];
const VALID_TIME_SLOTS = ["morning", "afternoon"];

function generateBookingRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AOC-${timestamp}-${random}`;
}

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

  // In production, this is where you'd:
  // - Save to database
  // - Send confirmation email
  // - Integrate with scheduling system
  // For now, simulate a brief processing delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const bookingRef = generateBookingRef();

  return { success: true, bookingRef };
}
