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
// assign_booking_employees (supabase/006) returns jsonb; tests set the shape per case.
const rpcMock = vi.fn(
  (): Promise<{ data: unknown; error: DbError }> =>
    Promise.resolve({ data: { status: "saved", added: [], removed: [], overridden: [] }, error: null }),
);
const updateSelectMock = vi.fn(() => Promise.resolve({ data: [{ id: "b-1" }], error: null }));
// .eq() is chainable (confirmBooking filters on id and status) and ends in .select().
type UpdateFilter = { eq: (column: string, value: string) => UpdateFilter; select: typeof updateSelectMock };
const updateEqMock = vi.fn<UpdateFilter["eq"]>(() => updateFilter);
const updateFilter: UpdateFilter = { eq: updateEqMock, select: updateSelectMock };
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const activityLogInsertMock = vi.fn(() => Promise.resolve({ error: null }));
const fromMock = vi.fn((table: string) => {
  if (table === "bookings") return { update: updateMock };
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
  updateSelectMock.mockResolvedValue({ data: [{ id: "b-1" }], error: null });
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

describe("confirmBooking", () => {
  it("rejects when there is no session at all, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(SIGNED_OUT);

    const result = await confirmBooking("b-1");

    expect(result).toEqual({
      success: false,
      error: "You must be signed in to do this.",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user without the admin role, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(NON_ADMIN);

    const result = await confirmBooking("b-1");

    expect(result).toEqual({
      success: false,
      error: "You are not authorized to do this.",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("moves a pending booking to confirmed and logs the session admin's email", async () => {
    const result = await confirmBooking("b-1");

    expect(result).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed" }),
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "b-1");
    expect(activityLogInsertMock).toHaveBeenCalledWith({
      booking_id: "b-1",
      description: "Confirmed by admin@example.com",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("only ever updates a booking that is still pending", async () => {
    await confirmBooking("b-1");

    // Without this filter a cancelled booking could be brought back.
    expect(updateEqMock).toHaveBeenCalledWith("status", "pending");
  });

  it("refuses a booking that is no longer pending and does not log activity", async () => {
    // The status filter matched nothing: cancelled, completed, or already confirmed.
    updateSelectMock.mockResolvedValue({ data: [], error: null });

    const result = await confirmBooking("b-1");

    expect(result).toEqual({
      success: false,
      error: "This booking is no longer pending, so it can't be confirmed.",
    });
    expect(activityLogInsertMock).not.toHaveBeenCalled();
    // Both places with a Confirm button get the booking's real status back.
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/bookings/b-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("logs only the error code and a correlation id when the write fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    updateSelectMock.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "row echo: jane@example.com" },
    } as never);

    const result = await confirmBooking("b-1");

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("42501");
    expect(logged).not.toContain("jane@example.com");
    expect(activityLogInsertMock).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("updateBookingStatus", () => {
  it("rejects when there is no session at all, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(SIGNED_OUT);

    const result = await updateBookingStatus("b-1", "done");

    expect(result).toEqual({
      success: false,
      error: "You must be signed in to do this.",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user without the admin role, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(NON_ADMIN);

    const result = await updateBookingStatus("b-1", "done");

    expect(result).toEqual({
      success: false,
      error: "You are not authorized to do this.",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("treats zero affected rows as failure and does not log activity", async () => {
    updateSelectMock.mockResolvedValue({ data: [], error: null });

    const result = await updateBookingStatus("missing-id", "done");

    expect(result).toEqual({ success: false, error: "Booking not found." });
    expect(activityLogInsertMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("updates the row and logs the session admin's email", async () => {
    const result = await updateBookingStatus("b-1", "done");

    expect(result).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done" }),
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "b-1");
    expect(activityLogInsertMock).toHaveBeenCalledWith({
      booking_id: "b-1",
      description: "Marked complete by admin@example.com",
    });
  });
});
