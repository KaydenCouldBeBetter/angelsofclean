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

import { submitBooking } from "../submitBooking";

const VALID_INPUT = {
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

describe("submitBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bookingsInsertMock.mockImplementation(() => ({ select: selectMock }));
    selectMock.mockImplementation(() => ({ single: singleMock }));
    activityLogInsertMock.mockImplementation(() => Promise.resolve({ error: null }));
    singleMock.mockResolvedValue({ data: null, error: null });
  });

  it("rejects an invalid service type without touching the database", async () => {
    const result = await submitBooking({ ...VALID_INPUT, service: "bogus" });
    expect(result).toEqual({ success: false, error: "Invalid service type." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-service-area ZIP without touching the database", async () => {
    const result = await submitBooking({ ...VALID_INPUT, zip: "99999" });
    expect(result).toEqual({ success: false, error: "We don't currently serve this area." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email without touching the database", async () => {
    const result = await submitBooking({ ...VALID_INPUT, email: "not-an-email" });
    expect(result).toEqual({ success: false, error: "Invalid email address." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone number without touching the database", async () => {
    const result = await submitBooking({ ...VALID_INPUT, phone: "123" });
    expect(result).toEqual({ success: false, error: "Invalid phone number." });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range bedroom count without touching the database", async () => {
    const result = await submitBooking({ ...VALID_INPUT, bedrooms: 9 });
    expect(result).toEqual({
      success: false,
      error: "Bedroom and bathroom count must be between 1 and 5.",
    });
    expect(bookingsInsertMock).not.toHaveBeenCalled();
  });

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

  it("returns a generic error and does not log activity when the insert fails", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "connection refused" },
    });

    const result = await submitBooking(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
    expect(activityLogInsertMock).not.toHaveBeenCalled();
  });
});
