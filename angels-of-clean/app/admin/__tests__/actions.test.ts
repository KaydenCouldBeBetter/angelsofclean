import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

const requireAdminMock = vi.fn();

vi.mock("@/lib/supabase/require-admin", () => ({
  requireAdmin: () => requireAdminMock(),
}));

import { assignEmployees, updateBookingStatus } from "../actions";

// Chainable mocks mirroring the Supabase query builder calls the actions make.
const deleteEqMock = vi.fn(() => Promise.resolve({ error: null }));
const assignInsertMock = vi.fn(() => Promise.resolve({ error: null }));
const updateSelectMock = vi.fn(() => Promise.resolve({ data: [{ id: "b-1" }], error: null }));
const updateEqMock = vi.fn(() => ({ select: updateSelectMock }));
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
  supabase: { from: fromMock },
  user: { email: "admin@example.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN_CONTEXT);
  updateSelectMock.mockResolvedValue({ data: [{ id: "b-1" }], error: null });
});

describe("assignEmployees", () => {
  it("rejects when there is no verified admin session, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(null);

    const result = await assignEmployees("b-1", ["e-1"]);

    expect(result).toEqual({
      success: false,
      error: "You must be signed in to do this.",
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
});

describe("updateBookingStatus", () => {
  it("rejects when there is no verified admin session, without touching the database", async () => {
    requireAdminMock.mockResolvedValue(null);

    const result = await updateBookingStatus("b-1", "done");

    expect(result).toEqual({
      success: false,
      error: "You must be signed in to do this.",
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
