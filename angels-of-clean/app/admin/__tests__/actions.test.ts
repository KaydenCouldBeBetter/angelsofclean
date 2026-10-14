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
const deleteEqMock = vi.fn((): Promise<{ error: DbError }> => Promise.resolve({ error: null }));
const assignInsertMock = vi.fn(() => Promise.resolve({ error: null }));
const updateSelectMock = vi.fn(() => Promise.resolve({ data: [{ id: "b-1" }], error: null }));
// .eq() is chainable (confirmBooking filters on id and status) and ends in .select().
type UpdateFilter = { eq: (column: string, value: string) => UpdateFilter; select: typeof updateSelectMock };
const updateEqMock = vi.fn<UpdateFilter["eq"]>(() => updateFilter);
const updateFilter: UpdateFilter = { eq: updateEqMock, select: updateSelectMock };
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const activityLogInsertMock = vi.fn(() => Promise.resolve({ error: null }));
const fromMock = vi.fn((table: string) => {
  if (table === "booking_employees") {
    return { delete: () => ({ eq: deleteEqMock }), insert: assignInsertMock };
  }
  if (table === "bookings") return { update: updateMock };
  if (table === "activity_log") return { insert: activityLogInsertMock };
  throw new Error(`Unexpected table in test: ${table}`);
});

const ADMIN_CONTEXT = {
  ok: true,
  supabase: { from: fromMock },
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

describe("assignEmployees", () => {
  it("rejects when there is no session at all, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(SIGNED_OUT);

    const result = await assignEmployees("b-1", ["e-1"]);

    expect(result).toEqual({
      success: false,
      error: "You must be signed in to do this.",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user without the admin role, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(NON_ADMIN);

    const result = await assignEmployees("b-1", ["e-1"]);

    expect(result).toEqual({
      success: false,
      error: "You are not authorized to do this.",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("saves assignments and logs the session admin's email", async () => {
    const result = await assignEmployees("b-1", ["e-1", "e-2"]);

    expect(result).toEqual({ success: true });
    expect(assignInsertMock).toHaveBeenCalledWith([
      { booking_id: "b-1", employee_id: "e-1" },
      { booking_id: "b-1", employee_id: "e-2" },
    ]);
    expect(activityLogInsertMock).toHaveBeenCalledWith({
      booking_id: "b-1",
      description: "Employees assigned by admin@example.com",
    });
  });

  it("logs only the error code and a correlation id when the write fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Supabase errors can echo row data — the log must not repeat it.
    deleteEqMock.mockResolvedValueOnce({
      error: {
        code: "42501",
        message: "row echo: jane@example.com (315) 555-0100",
        details: "gate code 4321",
      },
    });

    const result = await assignEmployees("b-1", ["e-1"]);

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("42501");
    expect(logged).not.toContain("jane@example.com");
    expect(logged).not.toContain("gate code 4321");
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
