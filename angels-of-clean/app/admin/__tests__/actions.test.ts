import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

const requireAdminMock = vi.fn();

vi.mock("@/lib/supabase/require-admin", () => ({
  requireAdmin: () => requireAdminMock(),
  NOT_SIGNED_IN_ERROR: "You must be signed in to do this.",
  NOT_AUTHORIZED_ERROR: "You are not authorized to do this.",
}));

import { assignEmployees, confirmBooking, updateBookingStatus } from "../actions";

// Chainable mocks mirroring the Supabase query builder calls the actions make.
type DbError = { code: string; message?: string; details?: string } | null;
// assign_booking_employees and set_booking_status return jsonb; tests set the
// shape per case.
const rpcMock = vi.fn(
  (): Promise<{ data: unknown; error: DbError }> =>
    Promise.resolve({ data: { status: "saved", added: [], removed: [], overridden: [] }, error: null }),
);
const activityLogInsertMock = vi.fn(() => Promise.resolve({ error: null }));
// Status changes never write a table directly (set_booking_status does both
// writes), so "bookings" isn't mocked: a direct update would throw here.
const fromMock = vi.fn((table: string) => {
  if (table === "activity_log") return { insert: activityLogInsertMock };
  throw new Error(`Unexpected table in test: ${table}`);
});

const ADMIN_CONTEXT = {
  ok: true,
  supabase: { from: fromMock, rpc: rpcMock },
  user: { email: "admin@example.com" },
};

const SIGNED_OUT = { ok: false, error: "You must be signed in to do this." };
// A real session exists but app_metadata.role !== "admin".
const NON_ADMIN = { ok: false, error: "You are not authorized to do this." };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN_CONTEXT);
});

const OVERLAP = {
  employee_id: "e-1",
  employee_name: "Marcus T.",
  booking_id: "b-9",
  booking_number: 1042,
  // 8:00 AM–12:00 PM in New York (EDT); stored as UTC like the real column.
  start_at: "2026-10-20T12:00:00+00:00",
  end_at: "2026-10-20T16:00:00+00:00",
};

function rpcReturns(data: unknown) {
  rpcMock.mockResolvedValueOnce({ data, error: null });
}

describe("assignEmployees", () => {
  it("rejects when there is no session at all, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(SIGNED_OUT);

    const result = await assignEmployees("b-1", ["e-1"], []);

    expect(result).toEqual({
      success: false,
      error: "You must be signed in to do this.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user without the admin role, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(NON_ADMIN);

    const result = await assignEmployees("b-1", ["e-1"], []);

    expect(result).toEqual({
      success: false,
      error: "You are not authorized to do this.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("saves through the single-transaction function and logs who was assigned", async () => {
    rpcReturns({ status: "saved", added: ["Ana V.", "Marcus T."], removed: [], overridden: [] });

    const result = await assignEmployees("b-1", ["e-1", "e-2"], []);

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("assign_booking_employees", {
      p_booking_id: "b-1",
      p_employee_ids: ["e-1", "e-2"],
      p_expected_employee_ids: [],
      p_allow_overlap: false,
    });
    // No direct table writes: the delete-then-insert path is gone.
    expect(fromMock).not.toHaveBeenCalledWith("booking_employees");
    expect(activityLogInsertMock).toHaveBeenCalledWith({
      booking_id: "b-1",
      description: "Assigned Ana V. and Marcus T. by admin@example.com",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bookings/b-1");
  });

  it("logs both who was added and who was removed", async () => {
    rpcReturns({ status: "saved", added: ["Lisa P."], removed: ["Rosa C."], overridden: [] });

    await assignEmployees("b-1", ["e-5"], ["e-3"]);

    expect(activityLogInsertMock).toHaveBeenCalledWith({
      booking_id: "b-1",
      description: "Assigned Lisa P.; unassigned Rosa C. by admin@example.com",
    });
  });

  it("succeeds without an activity entry when the crew didn't change", async () => {
    rpcReturns({ status: "saved", added: [], removed: [], overridden: [] });

    const result = await assignEmployees("b-1", ["e-1"], ["e-1"]);

    expect(result).toEqual({ success: true });
    expect(activityLogInsertMock).not.toHaveBeenCalled();
  });

  it("returns overlaps in New York time without saving or logging", async () => {
    rpcReturns({ status: "conflicts", conflicts: [OVERLAP] });

    const result = await assignEmployees("b-1", ["e-1"], []);

    expect(result).toEqual({
      success: false,
      conflicts: ["Marcus T. is already on #1042 (Tue, Oct 20, 8:00 AM – 12:00 PM)."],
    });
    expect(activityLogInsertMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("passes the override through and records it in the activity log", async () => {
    rpcReturns({ status: "saved", added: ["Marcus T."], removed: [], overridden: [OVERLAP] });

    const result = await assignEmployees("b-1", ["e-1"], [], { allowOverlap: true });

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith(
      "assign_booking_employees",
      expect.objectContaining({ p_allow_overlap: true }),
    );
    expect(activityLogInsertMock).toHaveBeenCalledWith({
      booking_id: "b-1",
      description: "Assigned Marcus T. (overlap with #1042 overridden) by admin@example.com",
    });
  });

  it("refuses when someone else changed the crew since the page loaded", async () => {
    rpcReturns({ status: "stale" });

    const result = await assignEmployees("b-1", ["e-1"], []);

    expect(result).toEqual({
      success: false,
      error: "Someone else changed this crew since you opened the page. Check the current crew and try again.",
    });
    expect(activityLogInsertMock).not.toHaveBeenCalled();
    // The page reloads with the crew as it is now.
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bookings/b-1");
  });

  it.each([
    ["done", "This booking is completed, so its crew can't be changed."],
    ["cancelled", "This booking is cancelled, so its crew can't be changed."],
  ])("refuses a %s booking", async (bookingStatus, message) => {
    rpcReturns({ status: "closed", booking_status: bookingStatus });

    const result = await assignEmployees("b-1", ["e-1"], []);

    expect(result).toEqual({ success: false, error: message });
    expect(activityLogInsertMock).not.toHaveBeenCalled();
  });

  it("reports a missing booking", async () => {
    rpcReturns({ status: "not_found" });

    const result = await assignEmployees("missing-id", ["e-1"], []);

    expect(result).toEqual({ success: false, error: "Booking not found." });
    expect(activityLogInsertMock).not.toHaveBeenCalled();
  });

  it("logs only the error code and a correlation id when the save fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Supabase errors can echo row data — the log must not repeat it.
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23503",
        message: "row echo: jane@example.com (315) 555-0100",
        details: "gate code 4321",
      },
    });

    const result = await assignEmployees("b-1", ["e-1"], []);

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("23503");
    expect(logged).not.toContain("jane@example.com");
    expect(logged).not.toContain("gate code 4321");
    expect(activityLogInsertMock).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("fails closed when migration 006 hasn't been run", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // PostgREST's "function not found" error.
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });

    const result = await assignEmployees("b-1", ["e-1"], []);

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
    expect(fromMock).not.toHaveBeenCalledWith("booking_employees");
    consoleSpy.mockRestore();
  });
});

// set_booking_status (supabase/migrations/20261019035418_booking_status_flow.sql)
// decides what's allowed; these tests cover what the actions send and how they
// report each answer. The database side of every transition is tested in
// supabase/tests/database/booking_status_flow.test.sql.
describe("updateBookingStatus", () => {
  it.each([
    ["signed out", SIGNED_OUT, "You must be signed in to do this."],
    ["signed in without the admin role", NON_ADMIN, "You are not authorized to do this."],
  ])("refuses a caller who is %s, without touching the database", async (_who, auth, message) => {
    requireAdminMock.mockResolvedValue(auth);

    const result = await updateBookingStatus("b-1", "done");

    expect(result).toEqual({ success: false, error: message });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it.each([
    ["confirmed", "Confirmed"],
    ["active", "Marked in progress"],
    ["done", "Marked complete"],
    ["cancelled", "Booking cancelled"],
  ] as const)("moves a booking to %s in one call that also writes the log", async (status, label) => {
    rpcReturns({ status: "changed", from: "pending", to: status });

    const result = await updateBookingStatus("b-1", status);

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    // The actor is never sent: the database takes it from the session token.
    expect(rpcMock).toHaveBeenCalledWith("set_booking_status", {
      p_booking_id: "b-1",
      p_status: status,
      p_description: label,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bookings/b-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/dashboard");
  });

  it.each([
    ["done", "done", "This booking is completed, so its status can't be changed."],
    ["cancelled", "active", "This booking is cancelled, so its status can't be changed."],
    ["done", "cancelled", "This booking is completed, so its status can't be changed."],
    ["active", "active", "This booking is already in progress."],
    ["pending", "done", "This booking is pending, so it can't be marked complete."],
    ["pending", "active", "This booking is pending, so it can't be marked in progress."],
    ["confirmed", "done", "This booking is confirmed, so it can't be marked complete."],
  ] as const)(
    "explains a refusal when the booking is %s and the admin asked for %s",
    async (current, target, message) => {
      rpcReturns({ status: "refused", booking_status: current });

      const result = await updateBookingStatus("b-1", target);

      expect(result).toEqual({ success: false, error: message });
      expect(fromMock).not.toHaveBeenCalled();
      // The page reloads showing the booking's real status.
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bookings/b-1");
    },
  );

  it("reports a missing booking", async () => {
    rpcReturns({ status: "not_found" });

    const result = await updateBookingStatus("missing-id", "done");

    expect(result).toEqual({ success: false, error: "Booking not found." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it.each(["pending", "reopened", "__proto__"])(
    "refuses the target %j without calling the database",
    async (status) => {
      const result = await updateBookingStatus("b-1", status as never);

      expect(result).toEqual({ success: false, error: "That status change isn't allowed." });
      expect(rpcMock).not.toHaveBeenCalled();
    },
  );

  it("logs only the error code and a correlation id when the call fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "row echo: jane@example.com", details: "gate code 4321" },
    });

    const result = await updateBookingStatus("b-1", "done");

    expect(result).toEqual({ success: false, error: "Something went wrong. Please try again." });
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("23514");
    expect(logged).not.toContain("jane@example.com");
    expect(logged).not.toContain("gate code 4321");
    consoleSpy.mockRestore();
  });

  it("fails closed when the status migration hasn't been run", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // PostgREST's "function not found" error.
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });

    const result = await updateBookingStatus("b-1", "cancelled");

    expect(result).toEqual({ success: false, error: "Something went wrong. Please try again." });
    // No fallback to the old unchecked update.
    expect(fromMock).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("confirmBooking", () => {
  it.each([
    ["signed out", SIGNED_OUT, "You must be signed in to do this."],
    ["signed in without the admin role", NON_ADMIN, "You are not authorized to do this."],
  ])("refuses a caller who is %s, without touching the database", async (_who, auth, message) => {
    requireAdminMock.mockResolvedValue(auth);

    const result = await confirmBooking("b-1");

    expect(result).toEqual({ success: false, error: message });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("confirms through set_booking_status", async () => {
    rpcReturns({ status: "changed", from: "pending", to: "confirmed" });

    const result = await confirmBooking("b-1");

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("set_booking_status", {
      p_booking_id: "b-1",
      p_status: "confirmed",
      p_description: "Confirmed",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/dashboard");
  });

  it.each([
    ["active", "This booking is no longer pending, so it can't be confirmed."],
    ["confirmed", "This booking is already confirmed."],
    ["cancelled", "This booking is cancelled, so its status can't be changed."],
    ["done", "This booking is completed, so its status can't be changed."],
  ] as const)("refuses a booking that is already %s", async (current, message) => {
    rpcReturns({ status: "refused", booking_status: current });

    const result = await confirmBooking("b-1");

    expect(result).toEqual({ success: false, error: message });
    // Both places with a Confirm button get the booking's real status back.
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bookings/b-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/dashboard");
  });
});
