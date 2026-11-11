import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { isValidDateStr } from "@/lib/datetime";
import { parseDollarsToCents } from "@/lib/money";

// What the admin Customers forms send, checked on the server before anything is
// written. The database repeats the hard limits as CHECK constraints (lengths,
// the ZIP shape, the amount range, due on or after issued); these give a
// readable message first. Every validator takes `unknown`, because a Server
// Action's arguments come straight from the caller.

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

export const PLAN_SERVICE_TYPES = ["standard", "deep", "moveinout", "commercial"] as const;
// A plan repeats, so one-time isn't offered.
export const PLAN_FREQUENCIES = ["weekly", "bi-weekly", "monthly", "2-3x", "daily"] as const;
export const PLAN_STATUSES = ["active", "paused", "ended"] as const;

export type PlanServiceType = (typeof PLAN_SERVICE_TYPES)[number];
export type PlanFrequency = (typeof PLAN_FREQUENCIES)[number];
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export interface PlanInput {
  serviceType: PlanServiceType;
  frequency: PlanFrequency;
  address: string;
  city: string;
  zip: string;
  notes: string | null;
}

const isOneOf = <T extends readonly string[]>(list: T, value: unknown): value is T[number] =>
  typeof value === "string" && (list as readonly string[]).includes(value);

export function validatePlanInput(raw: unknown): Validated<PlanInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Invalid plan details." };
  const input = raw as Record<string, unknown>;

  if (!isOneOf(PLAN_SERVICE_TYPES, input.serviceType)) return { ok: false, error: "Choose a service type." };
  if (!isOneOf(PLAN_FREQUENCIES, input.frequency)) return { ok: false, error: "Choose how often." };

  const address = typeof input.address === "string" ? input.address.trim() : "";
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const zip = typeof input.zip === "string" ? input.zip.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";

  if (address === "") return { ok: false, error: "Enter the service address." };
  if (address.length > FIELD_MAX_LENGTHS.address) return { ok: false, error: "That address is too long." };
  if (city === "") return { ok: false, error: "Enter the city." };
  if (city.length > FIELD_MAX_LENGTHS.city) return { ok: false, error: "That city name is too long." };
  if (!/^\d{5}$/.test(zip)) return { ok: false, error: "Enter a 5-digit ZIP code." };
  if (notes.length > FIELD_MAX_LENGTHS.notes) return { ok: false, error: "Those notes are too long." };

  return {
    ok: true,
    value: {
      serviceType: input.serviceType,
      frequency: input.frequency,
      address,
      city,
      zip,
      notes: notes === "" ? null : notes,
    },
  };
}

// An invoice's text isn't one of the customer-typed FIELD_MAX_LENGTHS fields:
// these match the range CHECKs in 20261110173448_customer_billing_and_plans.sql.
export const INVOICE_DESCRIPTION_MAX = 200;
export const PAYMENT_NOTE_MAX = 200;

export interface InvoiceInput {
  amountCents: number;
  description: string;
  issuedOn: string;
  dueOn: string;
  bookingId: string | null;
  quoteId: string | null;
}

/** `today` is the New York date ("YYYY-MM-DD"), used when no issue date is sent. */
export function validateInvoiceInput(raw: unknown, today: string): Validated<InvoiceInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Invalid invoice details." };
  const input = raw as Record<string, unknown>;

  const amountCents = parseDollarsToCents(input.amount);
  if (amountCents === null) {
    return { ok: false, error: "Enter an amount in dollars, like 125.00, up to $1,000,000.00." };
  }

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description === "") return { ok: false, error: "Describe what the invoice is for." };
  if (description.length > INVOICE_DESCRIPTION_MAX) {
    return { ok: false, error: `Keep the description under ${INVOICE_DESCRIPTION_MAX} characters.` };
  }

  const issuedOn = typeof input.issuedOn === "string" && input.issuedOn !== "" ? input.issuedOn : today;
  if (!isValidDateStr(issuedOn)) return { ok: false, error: "Enter a valid issue date." };

  const dueOn = typeof input.dueOn === "string" ? input.dueOn : "";
  if (!isValidDateStr(dueOn)) return { ok: false, error: "Enter a valid due date." };
  if (dueOn < issuedOn) return { ok: false, error: "The due date can't be before the issue date." };

  const bookingId = input.bookingId ?? null;
  const quoteId = input.quoteId ?? null;
  if (bookingId !== null && !isUuid(bookingId)) return { ok: false, error: "Choose a visit from the list." };
  if (quoteId !== null && !isUuid(quoteId)) return { ok: false, error: "Choose a quote from the list." };
  if (bookingId !== null && quoteId !== null) {
    return { ok: false, error: "An invoice is for a visit or a quote, not both." };
  }

  return { ok: true, value: { amountCents, description, issuedOn, dueOn, bookingId, quoteId } };
}

export interface PaymentInput {
  paidOn: string;
  note: string | null;
}

export function validatePaymentInput(raw: unknown, today: string): Validated<PaymentInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Invalid payment details." };
  const input = raw as Record<string, unknown>;

  const paidOn = typeof input.paidOn === "string" && input.paidOn !== "" ? input.paidOn : today;
  if (!isValidDateStr(paidOn)) return { ok: false, error: "Enter a valid payment date." };
  if (paidOn > today) return { ok: false, error: "The payment date can't be in the future." };

  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > PAYMENT_NOTE_MAX) {
    return { ok: false, error: `Keep the note under ${PAYMENT_NOTE_MAX} characters.` };
  }
  return { ok: true, value: { paidOn, note: note === "" ? null : note } };
}

/** "AOC-1043", "aoc-1043" or "1043" as the booking number 1043, otherwise null. */
export function parseBookingNumber(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const match = input.trim().match(/^(?:AOC-)?(\d{1,9})$/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
