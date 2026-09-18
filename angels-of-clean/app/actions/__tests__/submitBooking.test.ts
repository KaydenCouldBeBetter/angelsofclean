import { describe, it, expect, vi, beforeEach } from "vitest";

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
    Promise.resolve({ user: { email: "admin@example.com" } }),
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

beforeEach(() => {
  vi.clearAllMocks();
  bookingsInsertMock.mockImplementation(() => ({ select: selectMock }));
  selectMock.mockImplementation(() => ({ single: singleMock }));
  activityLogInsertMock.mockImplementation(() => Promise.resolve({ error: null }));
  singleMock.mockResolvedValue({ data: null, error: null });
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

  it("stores start/end matching the advertised morning window (8–12), not the old 9–11", async () => {
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    await submitBooking(VALID_INPUT);

    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        start_at: new Date("2026-08-01T08:00:00").toISOString(),
        end_at: new Date("2026-08-01T12:00:00").toISOString(),
      }),
    );
  });

  it("stores start/end matching the advertised afternoon window (12–4), not the old 1–3", async () => {
    singleMock.mockResolvedValue({
      data: { id: "abc-123", booking_number: 1042 },
      error: null,
    });

    await submitBooking({ ...VALID_INPUT, timeSlot: "afternoon" });

    expect(bookingsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        start_at: new Date("2026-08-01T12:00:00").toISOString(),
        end_at: new Date("2026-08-01T16:00:00").toISOString(),
      }),
    );
  });
});

describe("adminCreateBooking", () => {
  it("rejects when there is no verified admin session, without touching the database", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(null);

    const result = await adminCreateBooking(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: "You must be signed in to do this.",
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
