import { BOOKING_MAX_DAYS_AHEAD, BUSINESS_PHONE, FIELD_MAX_LENGTHS } from "@/lib/constants";
import {
  addDaysToDateStr,
  isNyWallClockInFuture,
  isValidDateStr,
  nyDateStr,
  nyWallClockToInstant,
} from "@/lib/datetime";
import type { Validated } from "@/lib/admin-employees";

// Online booking rules, set by admins on the Settings page and applied to the
// public booking flow (never to bookings an admin creates). The database holds
// the same limits as CHECKs in supabase/migrations/20261113205039_booking_controls.sql,
// and supabase/__tests__/booking-controls.test.ts fails if they drift. The
// pages only hint; submitBooking runs checkBookable again and decides.

// Minimum notice, in hours. 0 keeps today's behaviour: any slot that hasn't started.
export const MIN_NOTICE_OPTIONS = [0, 2, 4, 12, 24, 48, 72] as const;
export const MIN_NOTICE_MAX_HOURS = 168;

// How far ahead (in days from today, New York) a customer may pick a date. The
// wizard has only ever offered 6, so that is the default.
export const MAX_DAYS_AHEAD_OPTIONS = [3, 6, 7, 14, 21, 30, 45, 60, BOOKING_MAX_DAYS_AHEAD] as const;

// Blackout dates may be added up to two years out.
export const BLACKOUT_MAX_DAYS_OUT = 730;

/** "No minimum", "12 hours", "24 hours (1 day)": how a notice option reads in the Settings select. */
export function noticeLabel(hours: number): string {
  if (hours === 0) return "No minimum";
  return hours >= 24 && hours % 24 === 0
    ? `${hours} hours (${hours / 24} day${hours === 24 ? "" : "s"})`
    : `${hours} hours`;
}

/** "6 days" for the day-limit select, with the two values worth explaining. */
export function daysAheadLabel(days: number): string {
  if (days === DEFAULT_BOOKING_RULES.maxDaysAhead) return `${days} days (standard)`;
  if (days === BOOKING_MAX_DAYS_AHEAD) return `${days} days (about 3 months)`;
  return `${days} days`;
}

export interface BookingRules {
  paused: boolean;
  pauseMessage: string;
  minNoticeHours: number;
  maxDaysAhead: number;
  // Upcoming closed days, "YYYY-MM-DD" (New York dates), ascending.
  blackoutDates: string[];
}

// Matches the column defaults. Also what the wizard assumes until the rules
// load, which is how it behaved before these settings existed.
export const DEFAULT_BOOKING_RULES: BookingRules = {
  paused: false,
  pauseMessage: "",
  minNoticeHours: 0,
  maxDaysAhead: 6,
  blackoutDates: [],
};

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/**
 * The jsonb from get_booking_rules() as rules, or null if it isn't the shape the
 * database promises (so a bad answer is never mistaken for "no rules").
 */
export function parseBookingRules(raw: unknown): BookingRules | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.paused !== "boolean") return null;
  if (typeof r.pause_message !== "string") return null;
  if (!isInt(r.min_notice_hours, 0, MIN_NOTICE_MAX_HOURS)) return null;
  if (!isInt(r.max_days_ahead, 1, BOOKING_MAX_DAYS_AHEAD)) return null;
  if (!Array.isArray(r.blackout_dates)) return null;
  if (!r.blackout_dates.every((d) => typeof d === "string" && isValidDateStr(d))) return null;
  return {
    paused: r.paused,
    pauseMessage: r.pause_message,
    minNoticeHours: r.min_notice_hours,
    maxDaysAhead: r.max_days_ahead,
    blackoutDates: [...(r.blackout_dates as string[])].sort(),
  };
}

/**
 * The rules as the public route sends them (camelCase), checked by the wizard
 * before it trusts them. null if the answer isn't exactly that shape.
 */
export function coerceBookingRules(raw: unknown): BookingRules | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return parseBookingRules({
    paused: r.paused,
    pause_message: r.pauseMessage,
    min_notice_hours: r.minNoticeHours,
    max_days_ahead: r.maxDaysAhead,
    blackout_dates: r.blackoutDates,
  });
}

/** What customers read while booking is paused: the admin's message, or ours. */
export function pauseText(rules: Pick<BookingRules, "pauseMessage">): string {
  return (
    rules.pauseMessage.trim() ||
    `Online booking is paused right now. Please call us at ${BUSINESS_PHONE.display} and we'll be glad to help.`
  );
}

export type BookableVerdict =
  | { ok: true }
  | { ok: false; reason: "paused" | "blackout" | "past" | "too_far" | "notice" };

/**
 * Whether a customer may book `dateStr` at `slotStart` ("HH:MM:SS", New York
 * time) under these rules. The first rule that fails wins, in the order a
 * customer would care about: closed shop, closed day, already started, too far
 * out, too little notice.
 */
export function checkBookable(
  rules: BookingRules,
  dateStr: string,
  slotStart: string,
  now: Date = new Date(),
): BookableVerdict {
  if (rules.paused) return { ok: false, reason: "paused" };
  if (rules.blackoutDates.includes(dateStr)) return { ok: false, reason: "blackout" };
  if (!isNyWallClockInFuture(dateStr, slotStart, now)) return { ok: false, reason: "past" };
  // YYYY-MM-DD strings compare correctly as text.
  if (dateStr > addDaysToDateStr(nyDateStr(now), rules.maxDaysAhead)) return { ok: false, reason: "too_far" };
  const startsIn = nyWallClockToInstant(dateStr, slotStart).getTime() - now.getTime();
  if (startsIn < rules.minNoticeHours * 3_600_000) return { ok: false, reason: "notice" };
  return { ok: true };
}

/** The sentence a customer sees for a refused booking. */
export function verdictMessage(
  verdict: Extract<BookableVerdict, { ok: false }>,
  rules: BookingRules,
): string {
  switch (verdict.reason) {
    case "paused":
      return pauseText(rules);
    case "blackout":
      return "We're not taking bookings on that date. Please choose another day.";
    case "past":
      return "That time has already passed. Please choose a later date or time.";
    case "too_far":
      return `Please choose a date within the next ${rules.maxDaysAhead} days.`;
    case "notice":
      return `We need at least ${rules.minNoticeHours} hours' notice. Please choose a later date or time.`;
  }
}

// --- Admin input (Settings page) -------------------------------------------------------

export interface BookingSettingsInput {
  paused: boolean;
  pauseMessage: string;
  minNoticeHours: number;
  maxDaysAhead: number;
}

const oneOf = <T extends number>(options: readonly T[], v: unknown): v is T =>
  typeof v === "number" && (options as readonly number[]).includes(v);

/** Checks what the Settings form sends. The database repeats every limit as a CHECK. */
export function validateBookingSettings(raw: unknown): Validated<BookingSettingsInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Invalid settings." };
  const input = raw as Record<string, unknown>;

  if (typeof input.paused !== "boolean") return { ok: false, error: "Invalid settings." };
  if (typeof input.pauseMessage !== "string") return { ok: false, error: "Invalid settings." };
  const pauseMessage = input.pauseMessage.trim();
  if (pauseMessage.length > FIELD_MAX_LENGTHS.pauseMessage) {
    return { ok: false, error: `The message must be ${FIELD_MAX_LENGTHS.pauseMessage} characters or fewer.` };
  }
  if (!oneOf(MIN_NOTICE_OPTIONS, input.minNoticeHours)) {
    return { ok: false, error: "Choose the minimum notice from the list." };
  }
  if (!oneOf(MAX_DAYS_AHEAD_OPTIONS, input.maxDaysAhead)) {
    return { ok: false, error: "Choose how far ahead customers can book from the list." };
  }
  return {
    ok: true,
    value: {
      paused: input.paused,
      pauseMessage,
      minNoticeHours: input.minNoticeHours,
      maxDaysAhead: input.maxDaysAhead,
    },
  };
}

export interface BlackoutInput {
  day: string; // "YYYY-MM-DD", New York calendar date
  label: string;
}

/** Checks a blackout date from the Settings form: a real day, today or later, within two years. */
export function validateBlackoutInput(raw: unknown, now: Date = new Date()): Validated<BlackoutInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Invalid date." };
  const input = raw as Record<string, unknown>;
  if (typeof input.day !== "string" || !isValidDateStr(input.day)) {
    return { ok: false, error: "Choose a valid date." };
  }
  const today = nyDateStr(now);
  if (input.day < today) return { ok: false, error: "That date has already passed." };
  if (input.day > addDaysToDateStr(today, BLACKOUT_MAX_DAYS_OUT)) {
    return { ok: false, error: "Choose a date within the next two years." };
  }
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (label.length > FIELD_MAX_LENGTHS.blackoutLabel) {
    return { ok: false, error: `The label must be ${FIELD_MAX_LENGTHS.blackoutLabel} characters or fewer.` };
  }
  return { ok: true, value: { day: input.day, label } };
}
