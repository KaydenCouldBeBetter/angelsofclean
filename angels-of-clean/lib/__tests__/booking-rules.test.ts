import { describe, expect, it } from "vitest";
import {
  BLACKOUT_MAX_DAYS_OUT,
  DEFAULT_BOOKING_RULES,
  MAX_DAYS_AHEAD_OPTIONS,
  MIN_NOTICE_OPTIONS,
  checkBookable,
  coerceBookingRules,
  daysAheadLabel,
  noticeLabel,
  parseBookingRules,
  pauseText,
  validateBlackoutInput,
  validateBookingSettings,
  verdictMessage,
  type BookingRules,
} from "../booking-rules";
import { BOOKING_MAX_DAYS_AHEAD, FIELD_MAX_LENGTHS } from "../constants";

const RULES: BookingRules = { ...DEFAULT_BOOKING_RULES, maxDaysAhead: 30 };
// 10:00 AM EDT on Wed 2026-07-15 (14:00 UTC).
const NOW = new Date("2026-07-15T14:00:00.000Z");

describe("DEFAULT_BOOKING_RULES", () => {
  it("keeps the wizard as it was: open, no minimum notice, a 6-day window", () => {
    expect(DEFAULT_BOOKING_RULES).toEqual({
      paused: false,
      pauseMessage: "",
      minNoticeHours: 0,
      maxDaysAhead: 6,
      blackoutDates: [],
    });
  });

  it("is a choice the admin can make again", () => {
    expect(MAX_DAYS_AHEAD_OPTIONS).toContain(DEFAULT_BOOKING_RULES.maxDaysAhead);
    expect(MIN_NOTICE_OPTIONS).toContain(DEFAULT_BOOKING_RULES.minNoticeHours);
  });
});

describe("parseBookingRules (the database's answer)", () => {
  const RAW = {
    paused: true,
    pause_message: "Back Monday.",
    min_notice_hours: 24,
    max_days_ahead: 14,
    blackout_dates: ["2026-12-25", "2026-11-26"],
  };

  it("maps every field and sorts the closed days", () => {
    expect(parseBookingRules(RAW)).toEqual({
      paused: true,
      pauseMessage: "Back Monday.",
      minNoticeHours: 24,
      maxDaysAhead: 14,
      blackoutDates: ["2026-11-26", "2026-12-25"],
    });
  });

  it.each([
    ["null", null],
    ["a string", "rules"],
    ["no paused flag", { ...RAW, paused: undefined }],
    ["paused as text", { ...RAW, paused: "false" }],
    ["a missing message", { ...RAW, pause_message: undefined }],
    ["negative notice", { ...RAW, min_notice_hours: -1 }],
    ["notice over a week", { ...RAW, min_notice_hours: 169 }],
    ["fractional notice", { ...RAW, min_notice_hours: 1.5 }],
    ["zero days ahead", { ...RAW, max_days_ahead: 0 }],
    ["more days than the ceiling", { ...RAW, max_days_ahead: BOOKING_MAX_DAYS_AHEAD + 1 }],
    ["closed days not a list", { ...RAW, blackout_dates: "2026-12-25" }],
    ["an impossible closed day", { ...RAW, blackout_dates: ["2026-02-31"] }],
    ["a closed day that isn't text", { ...RAW, blackout_dates: [20261225] }],
  ])("refuses %s, so a bad answer is never read as 'no rules'", (_name, raw) => {
    expect(parseBookingRules(raw)).toBeNull();
  });
});

describe("coerceBookingRules (the public route's answer, in the browser)", () => {
  it("accepts exactly what the route sends", () => {
    const rules: BookingRules = {
      paused: false,
      pauseMessage: "",
      minNoticeHours: 4,
      maxDaysAhead: 21,
      blackoutDates: ["2026-11-26"],
    };
    expect(coerceBookingRules(rules)).toEqual(rules);
  });

  it("refuses a different shape (the database's snake_case, an error body, nothing)", () => {
    expect(coerceBookingRules({ paused: false, pause_message: "", min_notice_hours: 0, max_days_ahead: 6, blackout_dates: [] })).toBeNull();
    expect(coerceBookingRules({ error: "Booking rules unavailable" })).toBeNull();
    expect(coerceBookingRules(null)).toBeNull();
    expect(coerceBookingRules({ ...DEFAULT_BOOKING_RULES, blackoutDates: "x" })).toBeNull();
  });
});

describe("pauseText", () => {
  it("is the admin's message, trimmed", () => {
    expect(pauseText({ pauseMessage: "  We're on holiday.  " })).toBe("We're on holiday.");
  });

  it("falls back to a message that gives the phone number", () => {
    const text = pauseText({ pauseMessage: "   " });
    expect(text).toContain("paused");
    expect(text).toContain("(315) 516-1266");
  });
});

describe("checkBookable", () => {
  const check = (rules: Partial<BookingRules>, date: string, start = "08:00:00") =>
    checkBookable({ ...RULES, ...rules }, date, start, NOW);

  it("allows an open day with time to spare", () => {
    expect(check({}, "2026-07-16")).toEqual({ ok: true });
  });

  it("refuses everything while paused, first of all", () => {
    expect(check({ paused: true, blackoutDates: ["2026-07-16"] }, "2026-07-16")).toEqual({ ok: false, reason: "paused" });
  });

  it("refuses a closed day, and only that day", () => {
    expect(check({ blackoutDates: ["2026-07-16"] }, "2026-07-16")).toEqual({ ok: false, reason: "blackout" });
    expect(check({ blackoutDates: ["2026-07-16"] }, "2026-07-17")).toEqual({ ok: true });
  });

  it("refuses a slot that has started, as 'past'", () => {
    expect(check({}, "2026-07-15", "08:00:00")).toEqual({ ok: false, reason: "past" }); // 8 AM, it's 10
    expect(check({}, "2026-07-14")).toEqual({ ok: false, reason: "past" });
    expect(check({}, "2026-07-15", "12:00:00")).toEqual({ ok: true }); // noon, two hours away
  });

  it("limits how far ahead, counting from New York's today, last day included", () => {
    expect(check({ maxDaysAhead: 6 }, "2026-07-21")).toEqual({ ok: true });
    expect(check({ maxDaysAhead: 6 }, "2026-07-22")).toEqual({ ok: false, reason: "too_far" });
  });

  it("counts 'today' in New York, not UTC: 11 PM EDT is already tomorrow in UTC", () => {
    const lateEvening = new Date("2026-07-16T03:00:00.000Z"); // 11 PM Jul 15 in New York
    const verdict = (date: string) =>
      checkBookable({ ...RULES, maxDaysAhead: 1 }, date, "08:00:00", lateEvening);
    expect(verdict("2026-07-16")).toEqual({ ok: true });
    expect(verdict("2026-07-17")).toEqual({ ok: false, reason: "too_far" });
  });

  it("requires the minimum notice, measured to the slot's start", () => {
    // Noon is exactly two hours from 10 AM.
    expect(check({ minNoticeHours: 2 }, "2026-07-15", "12:00:00")).toEqual({ ok: true });
    expect(check({ minNoticeHours: 3 }, "2026-07-15", "12:00:00")).toEqual({ ok: false, reason: "notice" });
    // Tomorrow 8 AM is 22 hours away: 24 hours' notice isn't met, 12 is.
    expect(check({ minNoticeHours: 24 }, "2026-07-16")).toEqual({ ok: false, reason: "notice" });
    expect(check({ minNoticeHours: 12 }, "2026-07-16")).toEqual({ ok: true });
  });

  it("counts notice in real hours across the spring-forward night", () => {
    // 10 AM EST Sat Mar 7 2026; the clocks jump at 2 AM Sunday, so 8 AM Sunday
    // EDT is 21 real hours away, not 22.
    const now = new Date("2026-03-07T15:00:00.000Z");
    const verdict = (hours: number) =>
      checkBookable({ ...RULES, minNoticeHours: hours }, "2026-03-08", "08:00:00", now);
    expect(verdict(21)).toEqual({ ok: true });
    expect(verdict(22)).toEqual({ ok: false, reason: "notice" });
  });
});

describe("verdictMessage", () => {
  const rules = { ...RULES, pauseMessage: "We're closed.", minNoticeHours: 24, maxDaysAhead: 14 };
  const message = (reason: "paused" | "blackout" | "past" | "too_far" | "notice") =>
    verdictMessage({ ok: false, reason }, rules);

  it("says what is wrong in words a customer can act on", () => {
    expect(message("paused")).toBe("We're closed.");
    expect(message("blackout")).toBe("We're not taking bookings on that date. Please choose another day.");
    expect(message("past")).toBe("That time has already passed. Please choose a later date or time.");
    expect(message("too_far")).toBe("Please choose a date within the next 14 days.");
    expect(message("notice")).toBe("We need at least 24 hours' notice. Please choose a later date or time.");
  });
});

describe("validateBookingSettings", () => {
  const VALID = { paused: true, pauseMessage: "  Back Monday. ", minNoticeHours: 24, maxDaysAhead: 30 };

  it("accepts a valid set, trimming the message", () => {
    expect(validateBookingSettings(VALID)).toEqual({
      ok: true,
      value: { paused: true, pauseMessage: "Back Monday.", minNoticeHours: 24, maxDaysAhead: 30 },
    });
  });

  it("allows a blank message and every offered value", () => {
    expect(validateBookingSettings({ ...VALID, pauseMessage: "" }).ok).toBe(true);
    for (const hours of MIN_NOTICE_OPTIONS) expect(validateBookingSettings({ ...VALID, minNoticeHours: hours }).ok).toBe(true);
    for (const days of MAX_DAYS_AHEAD_OPTIONS) expect(validateBookingSettings({ ...VALID, maxDaysAhead: days }).ok).toBe(true);
  });

  it("allows a message of exactly the limit, and refuses one a character over", () => {
    expect(validateBookingSettings({ ...VALID, pauseMessage: "a".repeat(FIELD_MAX_LENGTHS.pauseMessage) }).ok).toBe(true);
    const over = validateBookingSettings({ ...VALID, pauseMessage: "a".repeat(FIELD_MAX_LENGTHS.pauseMessage + 1) });
    expect(over).toEqual({ ok: false, error: "The message must be 200 characters or fewer." });
  });

  it.each([
    ["not an object", null],
    ["paused as text", { ...VALID, paused: "yes" }],
    ["a message that isn't text", { ...VALID, pauseMessage: 5 }],
    ["a notice not on the list", { ...VALID, minNoticeHours: 5 }],
    ["a notice as text", { ...VALID, minNoticeHours: "24" }],
    ["a day limit not on the list", { ...VALID, maxDaysAhead: 8 }],
    ["a day limit past the ceiling", { ...VALID, maxDaysAhead: 93 }],
    ["no day limit", { ...VALID, maxDaysAhead: undefined }],
  ])("refuses %s", (_name, raw) => {
    expect(validateBookingSettings(raw).ok).toBe(false);
  });
});

describe("validateBlackoutInput", () => {
  const input = (day: unknown, label: unknown = "") => validateBlackoutInput({ day, label }, NOW);

  it("accepts today and later, trimming the label", () => {
    expect(input("2026-07-15", "  Thanksgiving ")).toEqual({
      ok: true,
      value: { day: "2026-07-15", label: "Thanksgiving" },
    });
    expect(input("2026-12-25").ok).toBe(true);
  });

  it("refuses a past day, in New York time", () => {
    expect(input("2026-07-14")).toEqual({ ok: false, error: "That date has already passed." });
    // 11 PM Jul 15 in New York is Jul 16 in UTC; Jul 15 is still today there.
    expect(validateBlackoutInput({ day: "2026-07-15", label: "" }, new Date("2026-07-16T03:00:00Z")).ok).toBe(true);
  });

  it("allows up to two years out and no further", () => {
    const last = new Date(Date.UTC(2026, 6, 15 + BLACKOUT_MAX_DAYS_OUT)).toISOString().slice(0, 10);
    const after = new Date(Date.UTC(2026, 6, 15 + BLACKOUT_MAX_DAYS_OUT + 1)).toISOString().slice(0, 10);
    expect(input(last).ok).toBe(true);
    expect(input(after)).toEqual({ ok: false, error: "Choose a date within the next two years." });
  });

  it.each([["not a date", "soon"], ["an impossible date", "2026-02-31"], ["nothing", ""], ["a number", 20261225], ["null", null]])(
    "refuses %s",
    (_name, day) => {
      expect(input(day)).toEqual({ ok: false, error: "Choose a valid date." });
    },
  );

  it("refuses a label over the limit, and non-object input", () => {
    expect(input("2026-12-25", "a".repeat(FIELD_MAX_LENGTHS.blackoutLabel + 1)).ok).toBe(false);
    expect(input("2026-12-25", "a".repeat(FIELD_MAX_LENGTHS.blackoutLabel)).ok).toBe(true);
    expect(validateBlackoutInput(null, NOW).ok).toBe(false);
  });

  it("treats a label that isn't text as blank", () => {
    expect(input("2026-12-25", 5)).toEqual({ ok: true, value: { day: "2026-12-25", label: "" } });
  });
});

describe("option labels", () => {
  it("reads naturally in the Settings selects", () => {
    expect(noticeLabel(0)).toBe("No minimum");
    expect(noticeLabel(2)).toBe("2 hours");
    expect(noticeLabel(24)).toBe("24 hours (1 day)");
    expect(noticeLabel(72)).toBe("72 hours (3 days)");
    expect(daysAheadLabel(6)).toBe("6 days (standard)");
    expect(daysAheadLabel(14)).toBe("14 days");
    expect(daysAheadLabel(92)).toBe("92 days (about 3 months)");
  });
});
