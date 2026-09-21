import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const singleMock = vi.fn();
const selectMock = vi.fn(() => ({ single: singleMock }));
const bookingsInsertMock = vi.fn(() => ({ select: selectMock }));
const activityLogInsertMock = vi.fn(() => Promise.resolve({ error: null }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "bookings") return { insert: bookingsInsertMock };
      if (table === "activity_log") return { insert: activityLogInsertMock };
      throw new Error(`Unexpected table in test: ${table}`);
    },
  }),
}));

// adminCreateBooking derives the actor from the verified session.
vi.mock("@/lib/supabase/require-admin", () => ({
  requireAdmin: vi.fn(() =>
    Promise.resolve({ ok: true, user: { email: "admin@example.com" } }),
  ),
}));

import { submitBooking, adminCreateBooking, type BookingData } from "../submitBooking";
import { requireAdmin } from "@/lib/supabase/require-admin";

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
  singleMock.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

// Both actions share createBooking; running every validation case against both
// guards against the client and admin paths drifting apart again (code M4).
const ACTIONS = [
  ["submitBooking", (input: BookingData) => submitBooking(input)],
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

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
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

    const result = await submitBooking(VALID_INPUT);

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
    const result = await submitBooking({
      ...VALID_INPUT,
      date: "2026-07-15",
      timeSlot: "afternoon",
    });

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

    await submitBooking(VALID_INPUT);

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

    await submitBooking({ ...VALID_INPUT, timeSlot: "afternoon" });

    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        start_at: "2026-08-01T16:00:00.000Z",
        end_at: "2026-08-01T20:00:00.000Z",
      }),
    );
  });

  it("stores the correct UTC offsets on both sides of the fall DST change (Nov 1, 2026)", async () => {
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    // Oct 31 is still EDT (UTC-4): 8 AM NY = 12:00 UTC.
    await submitBooking({ ...VALID_INPUT, date: "2026-10-31" });
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ start_at: "2026-10-31T12:00:00.000Z" }),
    );

    // Nov 1 has fallen back to EST (UTC-5): 8 AM NY = 13:00 UTC.
    await submitBooking({ ...VALID_INPUT, date: "2026-11-01" });
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ start_at: "2026-11-01T13:00:00.000Z" }),
    );
  });

  it("stores the correct UTC offsets on both sides of the spring DST change (Mar 14, 2027)", async () => {
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    // Mar 13 is still EST (UTC-5): 8 AM NY = 13:00 UTC.
    await submitBooking({ ...VALID_INPUT, date: "2027-03-13" });
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ start_at: "2027-03-13T13:00:00.000Z" }),
    );

    // Mar 14 has sprung forward to EDT (UTC-4): 8 AM NY = 12:00 UTC.
    await submitBooking({ ...VALID_INPUT, date: "2027-03-14" });
    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ start_at: "2027-03-14T12:00:00.000Z" }),
    );
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
});
