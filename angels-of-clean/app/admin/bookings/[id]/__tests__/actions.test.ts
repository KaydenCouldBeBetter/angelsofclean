import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

const requireAdminMock = vi.fn();

vi.mock("@/lib/supabase/require-admin", () => ({
  requireAdmin: () => requireAdminMock(),
}));

import { updateEntryInstructions } from "../actions";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";

type DbError = { code: string; message?: string } | null;
const rpcMock = vi.fn<(fn: string, args: unknown) => Promise<{ data: unknown; error: DbError }>>(
  () => Promise.resolve({ data: { status: "saved" }, error: null }),
);
// Every write goes through set_booking_access, which also logs the change; a
// direct table write would throw here.
const fromMock = vi.fn((table: string) => {
  throw new Error(`Unexpected table in test: ${table}`);
});

const ADMIN_CONTEXT = {
  ok: true,
  supabase: { from: fromMock, rpc: rpcMock },
  user: { email: "admin@example.com" },
};

const SECRET = "Side gate code 4412";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN_CONTEXT);
});

describe("updateEntryInstructions", () => {
  it.each([
    ["no session at all", { ok: false, error: "You must be signed in to do this." }],
    ["a signed-in user without the admin role", { ok: false, error: "You are not authorized to do this." }],
  ])("rejects %s without touching the database", async (_case, auth) => {
    requireAdminMock.mockResolvedValue(auth);

    const result = await updateEntryInstructions("b-1", SECRET);

    expect(result).toEqual({ success: false, error: auth.error });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("saves them, trimmed, through set_booking_access and refreshes only the detail page", async () => {
    const result = await updateEntryInstructions("b-1", `  ${SECRET} \n`);

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("set_booking_access", {
      p_booking_id: "b-1",
      p_instructions: SECRET,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock.mock.calls).toEqual([["/admin/bookings/b-1"]]);
  });

  it("sends a blank value through so the database removes them", async () => {
    rpcMock.mockResolvedValueOnce({ data: { status: "removed" }, error: null });

    const result = await updateEntryInstructions("b-1", "   ");

    expect(result).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("set_booking_access", {
      p_booking_id: "b-1",
      p_instructions: "",
    });
  });

  it("doesn't refresh anything when nothing changed", async () => {
    rpcMock.mockResolvedValueOnce({ data: { status: "unchanged" }, error: null });

    expect(await updateEntryInstructions("b-1", SECRET)).toEqual({ success: true });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects over-long instructions without touching the database", async () => {
    const max = FIELD_MAX_LENGTHS.accessInstructions;

    const result = await updateEntryInstructions("b-1", "x".repeat(max + 1));

    expect(result).toEqual({
      success: false,
      error: `Entry instructions must be ${max} characters or fewer.`,
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a non-string payload instead of throwing", async () => {
    const result = await updateEntryInstructions("b-1", { length: 0 } as unknown as string);

    expect(result).toEqual({ success: false, error: "Invalid entry instructions." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("says so when the booking no longer exists", async () => {
    rpcMock.mockResolvedValueOnce({ data: { status: "not_found" }, error: null });

    const result = await updateEntryInstructions("b-1", SECRET);

    expect(result).toEqual({ success: false, error: "This booking no longer exists." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs only the error code, never the instructions, when the save fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: `row echo: ${SECRET}` },
    });

    const result = await updateEntryInstructions("b-1", SECRET);

    expect(result).toEqual({ success: false, error: "Something went wrong. Please try again." });
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("23514");
    expect(logged).not.toContain("4412");
    consoleSpy.mockRestore();
  });
});
