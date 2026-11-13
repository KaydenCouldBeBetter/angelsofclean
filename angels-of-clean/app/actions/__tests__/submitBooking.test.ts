import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const singleMock = vi.fn();
const selectMock = vi.fn(() => ({ single: singleMock }));
const bookingsInsertMock = vi.fn(() => ({ select: selectMock }));
const activityLogInsertMock = vi.fn(() => Promise.resolve({ error: null }));
type DbError = { code: string; message?: string } | null;
const accessInsertMock = vi.fn<(row: unknown) => Promise<{ error: DbError }>>(() =>
  Promise.resolve({ error: null }),
);
// Taking a booking back out when its entry instructions couldn't be stored.
const bookingsDeleteEqMock = vi.fn<(column: string, value: string) => Promise<{ error: DbError }>>(
  () => Promise.resolve({ error: null }),
);
const bookingsDeleteMock = vi.fn(() => ({ eq: bookingsDeleteEqMock }));

function fromTable(table: string) {
  if (table === "bookings") return { insert: bookingsInsertMock, delete: bookingsDeleteMock };
  if (table === "activity_log") return { insert: activityLogInsertMock };
  if (table === "booking_access") return { insert: accessInsertMock };
  throw new Error(`Unexpected table in test: ${table}`);
}

// The public path writes through the service role; the admin path through
// the admin's own session client (from requireAdmin). Same tables, so both
// share the spies above; these two tell the clients apart.
const createServiceRoleClientMock = vi.fn(() => ({ from: fromTable }));
const sessionFromMock = vi.fn(fromTable);

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

// adminCreateBooking derives the actor from the verified session.
vi.mock("@/lib/supabase/require-admin", () => ({
  requireAdmin: vi.fn(() =>
    Promise.resolve({
      ok: true,
      user: { email: "admin@example.com" },
      supabase: { from: sessionFromMock },
    }),
  ),
}));

const allowPublicBookingMock = vi.fn<(kind: string) => Promise<boolean>>(() => Promise.resolve(true));
vi.mock("@/lib/rate-limit", () => ({
  allowPublicSubmission: (kind: string) => allowPublicBookingMock(kind),
}));

// The online booking rules (pause, closed days, notice, how far ahead) are read
// through the signed-out client; here they are whatever each test says.
type RulesResult = { ok: true; data: BookingRules } | { ok: false };
const getPublicBookingRulesMock = vi.fn<() => Promise<RulesResult>>();
vi.mock("@/lib/supabase/booking-rules", () => ({
  getPublicBookingRules: () => getPublicBookingRulesMock(),
}));

import { submitBooking, adminCreateBooking, type BookingData } from "../submitBooking";
import { DEFAULT_BOOKING_RULES, type BookingRules } from "@/lib/booking-rules";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { BOOKING_MAX_DAYS_AHEAD, FIELD_MAX_LENGTHS } from "@/lib/constants";
import { MIN_FILL_MS, type BotCheck } from "@/lib/bot-check";

// What a person's browser sends: empty honeypot, well past the minimum fill time.
const HUMAN: BotCheck = { website: "", elapsedMs: 60_000 };

const VALID_INPUT: BookingData = {
  service: "standard",
  frequency: "one-time",
  address: "1 Test St",
  city: "Cicero",
  zip: "13039",
  bedrooms: 2,
  bathrooms: 1,
  notes: "",
  date: "2026-08-01",
  timeSlot: "morning",
  name: "Test User",
  email: "test@example.com",
  phone: "(315) 555-0100",
};

// Pin "now" so the fixed fixture dates are deterministically in the future and
// the new date-validation cases (past date, same-day cutoff) are stable. Only
// Date is faked, leaving the async supabase mocks' microtasks untouched.
// 2026-07-15 14:00 UTC = 10:00 AM EDT: today's morning slot (8 AM) has passed,
// afternoon (12 PM) has not; every fixture date (Aug 1 2026 → Mar 2027) is future.
const NOW = new Date("2026-07-15T14:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  bookingsInsertMock.mockImplementation(() => ({ select: selectMock }));
  selectMock.mockImplementation(() => ({ single: singleMock }));
  activityLogInsertMock.mockImplementation(() => Promise.resolve({ error: null }));
  accessInsertMock.mockImplementation(() => Promise.resolve({ error: null }));
  bookingsDeleteEqMock.mockImplementation(() => Promise.resolve({ error: null }));
  singleMock.mockResolvedValue({ data: null, error: null });
  allowPublicBookingMock.mockResolvedValue(true);
  // The fixtures book up to Mar 2027, so unless a test says otherwise customers
  // may book as far ahead as the server always allowed (3 months), with no
  // closed days and no minimum notice.
  withRules({});
});

function withRules(over: Partial<BookingRules>) {
  getPublicBookingRulesMock.mockResolvedValue({
    ok: true,
    data: { ...DEFAULT_BOOKING_RULES, maxDaysAhead: BOOKING_MAX_DAYS_AHEAD, ...over },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

// Both actions share createBooking; running every validation case against both
// guards against the client and admin paths drifting apart again (code M4).
const ACTIONS = [
  ["submitBooking", (input: BookingData) => submitBooking(input, HUMAN)],
  ["adminCreateBooking", (input: BookingData) => adminCreateBooking(input)],
] as const;

describe.each(ACTIONS)("%s validation", (_name, action) => {
  it("rejects an invalid service type without touching the database", async () => {
    const result = await action({ ...VALID_INPUT, service: "bogus" });
    expect(result).toEqual({ success: false, error: "Invalid service type." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-service-area ZIP without touching the database", async () => {
    const result = await action({ ...VALID_INPUT, zip: "99999" });
    expect(result).toEqual({ success: false, error: "We don't currently serve this area." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email without touching the database", async () => {
    const result = await action({ ...VALID_INPUT, email: "not-an-email" });
    expect(result).toEqual({ success: false, error: "Invalid email address." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone number without touching the database", async () => {
    const result = await action({ ...VALID_INPUT, phone: "123" });
    expect(result).toEqual({ success: false, error: "Invalid phone number." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range bedroom count without touching the database", async () => {
    const result = await action({ ...VALID_INPUT, bedrooms: 9 });
    expect(result).toEqual({
      success: false,
      error: "Bedroom and bathroom count must be between 1 and 5.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  // B42: half-bathrooms. bookings.bathrooms is numeric(2,1) with a half-step CHECK.
  it.each([1, 1.5, 2.5, 4.5, 5])("accepts and stores %s bathrooms", async (bathrooms) => {
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });
    const result = await action({ ...VALID_INPUT, bathrooms });
    expect(result.success).toBe(true);
    expect(bookingsInsertMock).toHaveBeenCalledWith(expect.objectContaining({ bathrooms }));
  });

  it.each([0, 0.5, 5.5, 6])("rejects %s bathrooms as out of range", async (bathrooms) => {
    const result = await action({ ...VALID_INPUT, bathrooms });
    expect(result).toEqual({
      success: false,
      error: "Bedroom and bathroom count must be between 1 and 5.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  // The database would round 1.49 to 1.5 and 2.25 to 2.3, so the action must
  // refuse them rather than store a different count.
  it.each([1.25, 1.49, 2.3, 3.75])("rejects %s bathrooms as not a half step", async (bathrooms) => {
    const result = await action({ ...VALID_INPUT, bathrooms });
    expect(result).toEqual({
      success: false,
      error: "Bathrooms must be a whole or half number, like 2 or 2.5.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it.each([
    ["name", "Name"],
    ["email", "Email address"],
    ["phone", "Phone number"],
    ["address", "Address"],
    ["city", "City"],
    ["notes", "Special instructions"],
    ["accessInstructions", "Entry instructions"],
  ] as const)("rejects an over-long %s without touching the database", async (field, label) => {
    const max = FIELD_MAX_LENGTHS[field];
    const result = await action({ ...VALID_INPUT, [field]: "x".repeat(max + 1) });
    expect(result).toEqual({
      success: false,
      error: `${label} must be ${max} characters or fewer.`,
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("accepts special instructions exactly at the limit", async () => {
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });
    const result = await action({ ...VALID_INPUT, notes: "x".repeat(FIELD_MAX_LENGTHS.notes) });
    expect(result.success).toBe(true);
  });

  it.each([
    ["a non-string field", { ...VALID_INPUT, notes: { length: 0 } }],
    ["non-string entry instructions", { ...VALID_INPUT, accessInstructions: { length: 0 } }],
    ["a missing field", { ...VALID_INPUT, email: undefined }],
    ["a fractional bedroom count", { ...VALID_INPUT, bedrooms: 2.5 }],
    ["a string room count", { ...VALID_INPUT, bathrooms: "2" }],
    ["a NaN bathroom count", { ...VALID_INPUT, bathrooms: NaN }],
    ["an infinite bathroom count", { ...VALID_INPUT, bathrooms: Infinity }],
    ["no payload at all", null],
  ])("rejects %s instead of throwing", async (_case, payload) => {
    // Server Action arguments are not type-checked at runtime.
    const result = await action(payload as unknown as BookingData);
    expect(result).toEqual({ success: false, error: "Invalid booking details." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid time slot without touching the database", async () => {
    const result = await action({ ...VALID_INPUT, timeSlot: "evening" });
    expect(result).toEqual({ success: false, error: "Invalid time slot." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed date without touching the database", async () => {
    const result = await action({ ...VALID_INPUT, date: "not-a-date" });
    expect(result).toEqual({ success: false, error: "Please choose a valid date." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an impossible calendar date without touching the database", async () => {
    const result = await action({ ...VALID_INPUT, date: "2026-02-30" });
    expect(result).toEqual({ success: false, error: "Please choose a valid date." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects a past date without touching the database", async () => {
    // NOW is 2026-07-15; the day before is in the past in New York.
    const result = await action({ ...VALID_INPUT, date: "2026-07-14" });
    expect(result).toEqual({
      success: false,
      error: "That time has already passed. Please choose a later date or time.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects a same-day slot whose start has already passed (cutoff)", async () => {
    // Today's morning slot (8 AM) at 10 AM NY — already started.
    const result = await action({
      ...VALID_INPUT,
      date: "2026-07-15",
      timeSlot: "morning",
    });
    expect(result).toEqual({
      success: false,
      error: "That time has already passed. Please choose a later date or time.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("returns a generic error and does not log activity when the insert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    singleMock.mockResolvedValue({
      data: null,
      // Supabase errors can echo the rejected row — the log must not repeat it.
      error: { code: "23514", message: "row: jane@example.com (315) 555-0100" },
    });

    const result = await action(VALID_INPUT);

    // `unavailable` is what sends the form to the service-unavailable screen.
    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
      unavailable: true,
    });
    expect(activityLogInsertMock).not.toHaveBeenCalled();

    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("23514");
    expect(logged).not.toContain("jane@example.com");
    consoleSpy.mockRestore();
  });
});

describe("submitBooking", () => {
  it("inserts a booking and returns a bookingRef on success", async () => {
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    const result = await submitBooking(VALID_INPUT, HUMAN);

    expect(result).toEqual({
      success: true,
      bookingRef: "AOC-1042",
      bookingId: "abc-123",
    });
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_name: "Test User",
        email: "test@example.com",
        service_type: "standard",
        frequency: "one-time",
        zip: "13039",
        time_slot: "morning",
      }),
    );
    expect(activityLogInsertMock).toHaveBeenCalledWith({
      booking_id: "abc-123",
      description: "Booking submitted by client",
    });
  });

  it("accepts a same-day slot that is still in the future", async () => {
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    // Today (2026-07-15) afternoon (starts 12 PM) at 10 AM NY — still bookable.
    const result = await submitBooking(
      { ...VALID_INPUT, date: "2026-07-15", timeSlot: "afternoon" },
      HUMAN,
    );

    expect(result.success).toBe(true);
    expect(bookingsInsertMock).toHaveBeenCalled();
  });

  // Aug 1 is EDT (UTC-4), so New York 8:00 AM = 12:00 UTC. These literals are
  // process-timezone-independent and prove the window is stored as New York
  // wall-clock time, not the server's local time.
  it("stores the morning window (8 AM–12 PM New York) as the correct UTC instants", async () => {
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    await submitBooking(VALID_INPUT, HUMAN);

    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        start_at: "2026-08-01T12:00:00.000Z",
        end_at: "2026-08-01T16:00:00.000Z",
      }),
    );
  });

  it("stores the afternoon window (12 PM–4 PM New York) as the correct UTC instants", async () => {
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    await submitBooking({ ...VALID_INPUT, timeSlot: "afternoon" }, HUMAN);

    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        start_at: "2026-08-01T16:00:00.000Z",
        end_at: "2026-08-01T20:00:00.000Z",
      }),
    );
  });

  it("stores the correct UTC offsets on both sides of the fall DST change (Nov 1, 2026)", async () => {
    // Within BOOKING_MAX_DAYS_AHEAD of these dates (approved test change, V1).
    vi.setSystemTime(new Date("2026-10-01T14:00:00.000Z"));
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    // Oct 31 is still EDT (UTC-4): 8 AM NY = 12:00 UTC.
    await submitBooking({ ...VALID_INPUT, date: "2026-10-31" }, HUMAN);
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ start_at: "2026-10-31T12:00:00.000Z" }),
    );

    // Nov 1 has fallen back to EST (UTC-5): 8 AM NY = 13:00 UTC.
    await submitBooking({ ...VALID_INPUT, date: "2026-11-01" }, HUMAN);
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ start_at: "2026-11-01T13:00:00.000Z" }),
    );
  });

  it("stores the correct UTC offsets on both sides of the spring DST change (Mar 14, 2027)", async () => {
    // Within BOOKING_MAX_DAYS_AHEAD of these dates (approved test change, V1).
    vi.setSystemTime(new Date("2027-02-15T15:00:00.000Z"));
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    // Mar 13 is still EST (UTC-5): 8 AM NY = 13:00 UTC.
    await submitBooking({ ...VALID_INPUT, date: "2027-03-13" }, HUMAN);
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ start_at: "2027-03-13T13:00:00.000Z" }),
    );

    // Mar 14 has sprung forward to EDT (UTC-4): 8 AM NY = 12:00 UTC.
    await submitBooking({ ...VALID_INPUT, date: "2027-03-14" }, HUMAN);
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ start_at: "2027-03-14T12:00:00.000Z" }),
    );
  });
});

// B38: door codes live in booking_access, never in bookings.notes, the
// activity log or the server logs. Public form only: the admin path refuses
// them (it couldn't roll a booking back; see adminCreateBooking below).
describe.each([ACTIONS[0]])("%s entry instructions", (_name, action) => {
  const SECRET = "Side gate code 4412, the cat stays inside";

  beforeEach(() => {
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });
  });

  it("stores them, trimmed, in booking_access and nowhere in the booking row", async () => {
    const result = await action({ ...VALID_INPUT, notes: "Skip the basement", accessInstructions: `  ${SECRET}\n` });

    expect(result.success).toBe(true);
    expect(accessInsertMock).toHaveBeenCalledWith({ booking_id: "abc-123", instructions: SECRET });
    expect(JSON.stringify(bookingsInsertMock.mock.calls)).not.toContain("4412");
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "Skip the basement" }),
    );
    // The activity entry says nothing about them.
    expect(JSON.stringify(activityLogInsertMock.mock.calls)).not.toContain("4412");
  });

  it.each([
    ["left out", undefined],
    ["empty", ""],
    ["only whitespace", "  \n "],
  ])("writes no booking_access row when they are %s", async (_case, accessInstructions) => {
    const result = await action({ ...VALID_INPUT, accessInstructions });

    expect(result.success).toBe(true);
    expect(accessInsertMock).not.toHaveBeenCalled();
  });

  it("accepts them exactly at the limit", async () => {
    const result = await action({
      ...VALID_INPUT,
      accessInstructions: "x".repeat(FIELD_MAX_LENGTHS.accessInstructions),
    });
    expect(result.success).toBe(true);
  });

  it("takes the booking back out, without logging them, when they can't be stored", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    accessInsertMock.mockResolvedValue({
      // Supabase errors can echo the rejected row.
      error: { code: "42P01", message: `row: ${SECRET}` },
    });

    const result = await action({ ...VALID_INPUT, accessInstructions: SECRET });

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
      unavailable: true,
    });
    expect(bookingsDeleteMock).toHaveBeenCalled();
    expect(bookingsDeleteEqMock).toHaveBeenCalledWith("id", "abc-123");
    expect(activityLogInsertMock).not.toHaveBeenCalled();

    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("42P01");
    expect(logged).not.toContain("4412");
    consoleSpy.mockRestore();
  });

  it("still reports the failure if taking the booking back out fails too", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    accessInsertMock.mockResolvedValue({ error: { code: "42P01" } });
    bookingsDeleteEqMock.mockResolvedValue({ error: { code: "57P03" } });

    const result = await action({ ...VALID_INPUT, accessInstructions: SECRET });

    expect(result.success).toBe(false);
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("57P03");
    expect(logged).not.toContain("4412");
    consoleSpy.mockRestore();
  });
});

describe("submitBooking rate limiting", () => {
  it("refuses a caller who is over the limit, without touching the database", async () => {
    allowPublicBookingMock.mockResolvedValue(false);

    const result = await submitBooking(VALID_INPUT, HUMAN);

    expect(result).toEqual({
      success: false,
      error:
        "We've received several booking requests from your connection. Please try again in about an hour.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
    expect(activityLogInsertMock).not.toHaveBeenCalled();
  });

  it("does not spend the caller's allowance on a request that fails validation", async () => {
    await submitBooking({ ...VALID_INPUT, email: "not-an-email" }, HUMAN);

    expect(allowPublicBookingMock).not.toHaveBeenCalled();
  });

  it("counts each valid public submission once", async () => {
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });

    await submitBooking(VALID_INPUT, HUMAN);

    expect(allowPublicBookingMock).toHaveBeenCalledTimes(1);
    expect(allowPublicBookingMock).toHaveBeenCalledWith("booking");
  });

  it("never rate-limits a signed-in admin creating a booking", async () => {
    allowPublicBookingMock.mockResolvedValue(false);
    singleMock.mockResolvedValue({ data: { id: "def-456", booking_number: 1043 }, error: null });

    const result = await adminCreateBooking(VALID_INPUT);

    expect(result.success).toBe(true);
    expect(allowPublicBookingMock).not.toHaveBeenCalled();
  });
});

describe("submitBooking bot check", () => {
  // A bot must get exactly what a real failure gets.
  const GENERIC_FAILURE = {
    success: false,
    error: "Something went wrong. Please try again.",
    unavailable: true,
  };

  function spyOnConsole() {
    return (["error", "warn", "log", "info"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
  }

  it("accepts a normal submit: empty honeypot, well past the minimum fill time", async () => {
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });

    const result = await submitBooking(VALID_INPUT, { website: "", elapsedMs: 45_000 });

    expect(result).toEqual({ success: true, bookingRef: "AOC-1042", bookingId: "abc-123" });
    expect(bookingsInsertMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a submit whose honeypot is filled, with the generic error and no trace", async () => {
    const spies = spyOnConsole();

    const result = await submitBooking(VALID_INPUT, {
      website: "http://spam.example",
      elapsedMs: 60_000,
    });

    expect(result).toEqual(GENERIC_FAILURE);
    expect(bookingsInsertMock).not.toHaveBeenCalled();
    expect(activityLogInsertMock).not.toHaveBeenCalled();
    expect(allowPublicBookingMock).not.toHaveBeenCalled();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    spies.forEach((spy) => spy.mockRestore());
  });

  it("rejects a submit that is too fast, with the generic error and no trace", async () => {
    const spies = spyOnConsole();

    const result = await submitBooking(VALID_INPUT, { website: "", elapsedMs: 400 });

    expect(result).toEqual(GENERIC_FAILURE);
    expect(bookingsInsertMock).not.toHaveBeenCalled();
    expect(activityLogInsertMock).not.toHaveBeenCalled();
    expect(allowPublicBookingMock).not.toHaveBeenCalled();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    spies.forEach((spy) => spy.mockRestore());
  });

  it("gives a bot the same answer as a failed insert", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    singleMock.mockResolvedValue({ data: null, error: { code: "23514" } });

    const failedInsert = await submitBooking(VALID_INPUT, HUMAN);
    const bot = await submitBooking(VALID_INPUT, { website: "x", elapsedMs: 60_000 });

    expect(bot).toEqual(failedInsert);
    consoleSpy.mockRestore();
  });

  it("rejects a bot even when its payload is otherwise invalid, without revealing why", async () => {
    const result = await submitBooking(
      { ...VALID_INPUT, email: "not-an-email" },
      { website: "x", elapsedMs: 0 },
    );

    expect(result).toEqual(GENERIC_FAILURE);
  });

  it("draws the line at the minimum fill time", async () => {
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });

    expect(
      await submitBooking(VALID_INPUT, { website: "", elapsedMs: MIN_FILL_MS - 1 }),
    ).toEqual(GENERIC_FAILURE);
    expect(bookingsInsertMock).not.toHaveBeenCalled();

    const result = await submitBooking(VALID_INPUT, { website: "", elapsedMs: MIN_FILL_MS });
    expect(result.success).toBe(true);
  });

  it.each([
    ["no bot check at all", undefined],
    ["a null bot check", null],
    ["a missing fill time", { website: "" }],
    ["a missing honeypot", { elapsedMs: 60_000 }],
    ["a string fill time", { website: "", elapsedMs: "60000" }],
    ["a NaN fill time", { website: "", elapsedMs: NaN }],
    ["a non-string honeypot", { website: null, elapsedMs: 60_000 }],
  ])("treats %s as a bot", async (_case, botCheck) => {
    const result = await submitBooking(VALID_INPUT, botCheck as unknown as BotCheck);

    expect(result).toEqual(GENERIC_FAILURE);
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("does not apply to admin-created bookings, which carry no bot check", async () => {
    singleMock.mockResolvedValue({ data: { id: "def-456", booking_number: 1043 }, error: null });

    const result = await adminCreateBooking(VALID_INPUT);

    expect(result.success).toBe(true);
  });
});

describe("adminCreateBooking", () => {
  it("rejects when there is no session at all, without touching the database", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      ok: false,
      error: "You must be signed in to do this.",
    });

    const result = await adminCreateBooking(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: "You must be signed in to do this.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
    expect(activityLogInsertMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user without the admin role, without touching the database", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      ok: false,
      error: "You are not authorized to do this.",
    });

    const result = await adminCreateBooking(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: "You are not authorized to do this.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
    expect(activityLogInsertMock).not.toHaveBeenCalled();
  });

  it("inserts the same row shape and logs the admin's email on success", async () => {
    singleMock.mockResolvedValue({
      data: { id: "def-456", booking_number: 1043 },
      error: null,
    });

    const result = await adminCreateBooking(VALID_INPUT);

    expect(result).toEqual({
      success: true,
      bookingRef: "AOC-1043",
      bookingId: "def-456",
    });
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_name: "Test User",
        email: "test@example.com",
        service_type: "standard",
        frequency: "one-time",
        zip: "13039",
        time_slot: "morning",
      }),
    );
    expect(activityLogInsertMock).toHaveBeenCalledWith({
      booking_id: "def-456",
      description: "Booking created by admin@example.com",
    });
  });

  it("writes through the admin's session and never creates a service-role client", async () => {
    singleMock.mockResolvedValue({ data: { id: "def-456", booking_number: 1043 }, error: null });

    const result = await adminCreateBooking(VALID_INPUT);

    expect(result.success).toBe(true);
    expect(sessionFromMock).toHaveBeenCalledWith("bookings");
    expect(sessionFromMock).toHaveBeenCalledWith("activity_log");
    expect(createServiceRoleClientMock).not.toHaveBeenCalled();
  });

  it("refuses entry instructions without touching the database", async () => {
    const result = await adminCreateBooking({ ...VALID_INPUT, accessInstructions: "Code 4412" });

    expect(result).toEqual({
      success: false,
      error: "Add entry instructions from the booking's page.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
    expect(accessInsertMock).not.toHaveBeenCalled();
    expect(createServiceRoleClientMock).not.toHaveBeenCalled();
  });

  it.each([["left out", undefined], ["blank", "  "]])(
    "accepts a booking whose entry instructions are %s",
    async (_case, accessInstructions) => {
      singleMock.mockResolvedValue({ data: { id: "def-456", booking_number: 1043 }, error: null });

      const result = await adminCreateBooking({ ...VALID_INPUT, accessInstructions });

      expect(result.success).toBe(true);
      expect(accessInsertMock).not.toHaveBeenCalled();
    },
  );
});

describe("submitBooking client", () => {
  it("still writes through the service role", async () => {
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });

    const result = await submitBooking(VALID_INPUT, HUMAN);

    expect(result.success).toBe(true);
    expect(createServiceRoleClientMock).toHaveBeenCalledTimes(1);
    expect(sessionFromMock).not.toHaveBeenCalled();
  });
});

// V1: the date step offers about a week, but a direct call could book any
// future date. Customers may book up to BOOKING_MAX_DAYS_AHEAD (owner: 3 months).
describe("how far ahead a customer can book", () => {
  // NOW is 2026-07-15 in New York; 92 days later is 2026-10-15.
  it("accepts the last allowed day", async () => {
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });
    expect((await submitBooking({ ...VALID_INPUT, date: "2026-10-15" }, HUMAN)).success).toBe(true);
  });

  it("refuses the day after, and far-future dates, before inserting", async () => {
    for (const date of ["2026-10-16", "2099-01-01"]) {
      expect(await submitBooking({ ...VALID_INPUT, date }, HUMAN)).toEqual({
        success: false,
        error: `Please choose a date within the next ${BOOKING_MAX_DAYS_AHEAD} days.`,
      });
    }
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("is 3 months, as the owner decided", () => {
    expect(BOOKING_MAX_DAYS_AHEAD).toBe(92);
  });

  it("doesn't limit admins, who book recurring and custom visits", async () => {
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });
    expect((await adminCreateBooking({ ...VALID_INPUT, date: "2027-03-01" })).success).toBe(true);
  });
});

// Admin Settings (phase 2a): the rules an admin sets apply to customers only,
// and the server decides whatever the pages showed.
describe("online booking rules", () => {
  // NOW is 10:00 AM EDT on Wed 2026-07-15.
  const book = (over: Partial<BookingData> = {}) => submitBooking({ ...VALID_INPUT, ...over }, HUMAN);
  const ok = () =>
    singleMock.mockResolvedValue({ data: { id: "abc-123", booking_number: 1042 }, error: null });

  describe("paused", () => {
    it("refuses with the admin's message and stores nothing", async () => {
      withRules({ paused: true, pauseMessage: "We're closed for renovations until Monday." });
      expect(await book()).toEqual({ success: false, error: "We're closed for renovations until Monday." });
      expect(bookingsInsertMock).not.toHaveBeenCalled();
    });

    it("falls back to a message with the phone number when none was written", async () => {
      withRules({ paused: true, pauseMessage: "  " });
      const result = await book();
      expect(result.success).toBe(false);
      expect(result.error).toContain("paused");
      expect(result.error).toContain("(315) 516-1266");
    });

    it("is answered before any other check, and before the rate limit is used", async () => {
      withRules({ paused: true });
      const result = await book({ zip: "99999", email: "nope" });
      expect(result.error).toContain("paused");
      expect(allowPublicBookingMock).not.toHaveBeenCalled();
    });

    it("never stops an admin, who also never reads the rules", async () => {
      withRules({ paused: true });
      ok();
      expect((await adminCreateBooking(VALID_INPUT)).success).toBe(true);
      expect(getPublicBookingRulesMock).not.toHaveBeenCalled();
    });
  });

  describe("closed days", () => {
    it("refuses a closed day before inserting, and still books the day after", async () => {
      withRules({ blackoutDates: ["2026-08-01"] });
      expect(await book({ date: "2026-08-01" })).toEqual({
        success: false,
        error: "We're not taking bookings on that date. Please choose another day.",
      });
      expect(bookingsInsertMock).not.toHaveBeenCalled();

      ok();
      expect((await book({ date: "2026-08-02" })).success).toBe(true);
    });

    it("doesn't stop an admin from booking a closed day", async () => {
      withRules({ blackoutDates: ["2026-08-01"] });
      ok();
      expect((await adminCreateBooking({ ...VALID_INPUT, date: "2026-08-01" })).success).toBe(true);
    });
  });

  describe("minimum notice", () => {
    it("refuses a slot that starts sooner than the notice, with a message that says how much", async () => {
      withRules({ minNoticeHours: 4 });
      // Today's afternoon slot starts at noon, two hours from now.
      expect(await book({ date: "2026-07-15", timeSlot: "afternoon" })).toEqual({
        success: false,
        error: "We need at least 4 hours' notice. Please choose a later date or time.",
      });
      expect(bookingsInsertMock).not.toHaveBeenCalled();
    });

    it("accepts a slot exactly at the notice, and one later", async () => {
      ok();
      withRules({ minNoticeHours: 2 });
      expect((await book({ date: "2026-07-15", timeSlot: "afternoon" })).success).toBe(true);
      withRules({ minNoticeHours: 12 });
      expect((await book({ date: "2026-07-16", timeSlot: "morning" })).success).toBe(true); // 22 hours out
    });

    it("counts a whole day of notice as 24 hours, not as 'tomorrow'", async () => {
      withRules({ minNoticeHours: 24 });
      expect((await book({ date: "2026-07-16", timeSlot: "morning" })).success).toBe(false); // 22 hours out
      ok();
      expect((await book({ date: "2026-07-16", timeSlot: "afternoon" })).success).toBe(true); // 26 hours out
    });

    it("still says 'already passed' for a slot that has started, not 'notice'", async () => {
      withRules({ minNoticeHours: 24 });
      expect((await book({ date: "2026-07-15", timeSlot: "morning" })).error).toBe(
        "That time has already passed. Please choose a later date or time.",
      );
    });

    it("doesn't apply to admins", async () => {
      withRules({ minNoticeHours: 72 });
      ok();
      expect((await adminCreateBooking({ ...VALID_INPUT, date: "2026-07-15", timeSlot: "afternoon" })).success).toBe(true);
    });
  });

  describe("how far ahead", () => {
    it("follows the admin's setting, not the old fixed 92 days", async () => {
      withRules({ maxDaysAhead: 6 });
      ok();
      expect((await book({ date: "2026-07-21" })).success).toBe(true); // today + 6
      expect(await book({ date: "2026-07-22" })).toEqual({
        success: false,
        error: "Please choose a date within the next 6 days.",
      });
    });
  });

  describe("when the rules can't be read", () => {
    it("refuses as unavailable, and neither stores nor uses up the rate limit", async () => {
      getPublicBookingRulesMock.mockResolvedValue({ ok: false });
      expect(await book()).toEqual({
        success: false,
        error: "Something went wrong. Please try again.",
        unavailable: true,
      });
      expect(bookingsInsertMock).not.toHaveBeenCalled();
      expect(allowPublicBookingMock).not.toHaveBeenCalled();
    });

    it("doesn't stop an admin, who doesn't need the rules", async () => {
      getPublicBookingRulesMock.mockResolvedValue({ ok: false });
      ok();
      expect((await adminCreateBooking(VALID_INPUT)).success).toBe(true);
    });
  });

  it("reads the rules once per customer booking", async () => {
    ok();
    await book();
    expect(getPublicBookingRulesMock).toHaveBeenCalledTimes(1);
  });
});
