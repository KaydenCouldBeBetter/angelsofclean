"use server";

import {
  COMMERCIAL_FACILITY_TYPES,
  COMMERCIAL_FREQUENCIES,
  COMMERCIAL_MAX_FLOORS,
  COMMERCIAL_SERVICE_AREAS,
  COMMERCIAL_SQFT_RANGES,
  FIELD_MAX_LENGTHS,
  SCHEDULE_PREFERENCES,
  SERVICE_AREA_ZIPS,
} from "@/lib/constants";
import { looksLikeBot, type BotCheck } from "@/lib/bot-check";
import { allowPublicSubmission } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { CommercialQuoteRow } from "@/lib/supabase/types";

export interface QuoteData {
  facilityType: string;
  sqftRange: string;
  address: string;
  city: string;
  zip: string;
  floors: number;
  serviceAreas: string[];
  notes: string;
  name: string;
  businessName: string;
  email: string;
  phone: string;
  frequency: string;
  schedulePreference: string | null;
}

export interface QuoteResult {
  success: boolean;
  quoteRef?: string;
  error?: string;
  // Set only when the quote could not be stored (the database was unreachable
  // or refused the insert), so the form can show the "service unavailable"
  // screen instead of a message about the customer's input.
  unavailable?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

// Derived from the lists the form itself renders, so what the form sends and
// what the server accepts can't drift apart.
const VALID_FACILITY_TYPES: string[] = COMMERCIAL_FACILITY_TYPES.map((t) => t.id);
const VALID_SQFT_RANGES: string[] = COMMERCIAL_SQFT_RANGES.map((r) => r.id);
const VALID_SERVICE_AREAS: string[] = COMMERCIAL_SERVICE_AREAS.map((a) => a.id);
const VALID_FREQUENCIES: string[] = COMMERCIAL_FREQUENCIES.map((f) => f.id);
const VALID_SCHEDULE_PREFERENCES: string[] = SCHEDULE_PREFERENCES.map((p) => p.id);

const STRING_FIELDS = [
  "facilityType", "sqftRange", "address", "city", "zip", "notes", "name", "businessName", "email", "phone", "frequency",
] as const;

const LENGTH_LIMITED_FIELDS: [keyof typeof FIELD_MAX_LENGTHS & keyof QuoteData, string][] = [
  ["name", "Contact name"],
  ["businessName", "Business name"],
  ["email", "Email address"],
  ["phone", "Phone number"],
  ["address", "Address"],
  ["city", "City"],
  ["notes", "Special requirements"],
];

// Log only the Postgres error code plus a correlation id — full Supabase
// error objects can echo the submitted row (customer PII) into server logs.
function logDbError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

// Server Action arguments come straight from the caller: the QuoteData type is
// not enforced at runtime, so a script can send anything.
function hasQuoteShape(data: unknown): data is QuoteData {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    STRING_FIELDS.every((field) => typeof record[field] === "string") &&
    Number.isInteger(record.floors) &&
    Array.isArray(record.serviceAreas) &&
    record.serviceAreas.every((area) => typeof area === "string") &&
    (record.schedulePreference === null || typeof record.schedulePreference === "string")
  );
}

export async function submitCommercialQuote(
  data: QuoteData,
  botCheck: BotCheck,
): Promise<QuoteResult> {
  // First, and answered exactly like a failed insert (same error, same
  // `unavailable` flag) so a bot learns nothing. Nothing is logged: the payload
  // is the bot's, not ours to keep.
  if (looksLikeBot(botCheck)) {
    return { success: false, error: "Something went wrong. Please try again.", unavailable: true };
  }

  if (!hasQuoteShape(data)) {
    return { success: false, error: "Invalid quote details." };
  }

  for (const [field, label] of LENGTH_LIMITED_FIELDS) {
    const max = FIELD_MAX_LENGTHS[field];
    if (data[field].length > max) {
      return { success: false, error: `${label} must be ${max} characters or fewer.` };
    }
  }

  if (!VALID_FACILITY_TYPES.includes(data.facilityType)) {
    return { success: false, error: "Invalid facility type." };
  }

  if (!VALID_SQFT_RANGES.includes(data.sqftRange)) {
    return { success: false, error: "Invalid facility size." };
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

  if (data.floors < 1 || data.floors > COMMERCIAL_MAX_FLOORS) {
    return {
      success: false,
      error: `Number of floors must be between 1 and ${COMMERCIAL_MAX_FLOORS}.`,
    };
  }

  const serviceAreas = [...new Set(data.serviceAreas)];
  if (serviceAreas.length === 0) {
    return { success: false, error: "Select at least one area to be serviced." };
  }

  if (!serviceAreas.every((area) => VALID_SERVICE_AREAS.includes(area))) {
    return { success: false, error: "Invalid service area." };
  }

  if (!data.name.trim()) {
    return { success: false, error: "Contact name is required." };
  }

  if (!data.businessName.trim()) {
    return { success: false, error: "Business name is required." };
  }

  if (!EMAIL_REGEX.test(data.email.trim())) {
    return { success: false, error: "Invalid email address." };
  }

  if (!PHONE_REGEX.test(data.phone.trim())) {
    return { success: false, error: "Invalid phone number." };
  }

  if (!VALID_FREQUENCIES.includes(data.frequency)) {
    return { success: false, error: "Invalid frequency." };
  }

  // The schedule preference is optional on the form.
  if (
    data.schedulePreference !== null &&
    !VALID_SCHEDULE_PREFERENCES.includes(data.schedulePreference)
  ) {
    return { success: false, error: "Invalid schedule preference." };
  }

  // Counted after validation, so only requests that would insert a row use up
  // the caller's allowance.
  if (!(await allowPublicSubmission("quote"))) {
    return {
      success: false,
      error:
        "We've received several quote requests from your connection. Please try again in about an hour.",
    };
  }

  const supabase = createServiceRoleClient();

  const { data: quote, error: insertError } = await supabase
    .from("commercial_quotes")
    .insert({
      business_name: data.businessName.trim(),
      contact_name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      facility_type: data.facilityType as CommercialQuoteRow["facility_type"],
      sqft_range: data.sqftRange as CommercialQuoteRow["sqft_range"],
      address: data.address.trim(),
      city: data.city.trim(),
      zip: data.zip.trim(),
      floors: data.floors,
      service_areas: serviceAreas,
      frequency: data.frequency as CommercialQuoteRow["frequency"],
      schedule_preference: data.schedulePreference as CommercialQuoteRow["schedule_preference"],
      notes: data.notes.trim() || null,
    })
    .select("quote_number")
    .single();

  // Never report success unless the row is stored: a lost lead behind a
  // success screen is exactly what this action exists to prevent.
  if (insertError || !quote) {
    logDbError("submitCommercialQuote: insert", insertError);
    return { success: false, error: "Something went wrong. Please try again.", unavailable: true };
  }

  return { success: true, quoteRef: `COM-${quote.quote_number}` };
}
