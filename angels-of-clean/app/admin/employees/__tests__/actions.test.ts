import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));

const requireAdminMock = vi.fn();
vi.mock("@/lib/supabase/require-admin", () => ({ requireAdmin: () => requireAdminMock() }));

import { createEmployee, setEmployeeArchived } from "../actions";

type DbError = { code: string } | null;
const rpcMock = vi.fn((): Promise<{ data: unknown; error: DbError }> => Promise.resolve({ data: null, error: null }));
const ADMIN = { ok: true, supabase: { rpc: rpcMock }, user: { email: "admin@example.com" } };

const ID = "11111111-1111-4111-8111-111111111111";
const GOOD = { name: "Pat Q.", phone: "315-555-0999", hiredDate: "2026-11-01" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN);
});

function rpcReturns(data: unknown) {
  rpcMock.mockResolvedValueOnce({ data, error: null });
}

describe.each([
  ["createEmployee", () => createEmployee(GOOD)],
  ["setEmployeeArchived", () => setEmployeeArchived(ID, true)],
])("%s access", (_name, call) => {
  it("rejects a signed-out visitor without touching the database", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "You must be signed in to do this." });
    expect(await call()).toEqual({ success: false, error: "You must be signed in to do this." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user without the admin role", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "You are not authorized to do this." });
    expect(await call()).toEqual({ success: false, error: "You are not authorized to do this." });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("createEmployee", () => {
  it("validates first and sends the cleaned values", async () => {
    rpcReturns({ status: "created", id: ID });

    expect(await createEmployee({ ...GOOD, name: "  Pat   Q. " })).toEqual({ success: true });

    expect(rpcMock).toHaveBeenCalledWith("create_employee", {
      p_name: "Pat Q.",
      p_initials: "PQ",
      p_phone: "(315) 555-0999",
      p_hired_date: "2026-11-01",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/employees");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("returns a readable error for bad input without calling the database", async () => {
    expect(await createEmployee({ ...GOOD, phone: "123" })).toEqual({
      success: false,
      error: "Enter a 10-digit phone number.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("doesn't throw on garbage arguments", async () => {
    expect((await createEmployee(null)).success).toBe(false);
    expect((await createEmployee("x")).success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("points at the archived employee when the phone number is theirs", async () => {
    rpcReturns({ status: "duplicate_phone", employee_name: "Lisa P.", archived: true });
    expect(await createEmployee(GOOD)).toEqual({
      success: false,
      error: "Lisa P. has that phone number and is archived. Reactivate them from the Archived tab instead of adding them again.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("says who already has the phone number when they're active", async () => {
    rpcReturns({ status: "duplicate_phone", employee_name: "Ana V.", archived: false });
    expect(await createEmployee(GOOD)).toEqual({ success: false, error: "Ana V. already has that phone number." });
  });

  it("handles two admins adding the same number at once (unique violation)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    expect(await createEmployee(GOOD)).toEqual({
      success: false,
      error: "An employee with that phone number is already on the roster.",
    });
  });

  it("logs only the error code and a correlation id when the call fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42883" } });

    expect(await createEmployee(GOOD)).toEqual({ success: false, error: "Something went wrong. Please try again." });

    expect(errorSpy).toHaveBeenCalledWith("createEmployee failed", {
      code: "42883",
      correlationId: expect.any(String),
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("Pat");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("555");
    errorSpy.mockRestore();
  });
});

describe("setEmployeeArchived", () => {
  it.each([
    ["archived", true],
    ["reactivated", false],
    ["unchanged", true],
  ])("%s succeeds and refreshes the pages that list staff", async (status, archive) => {
    rpcReturns({ status });

    expect(await setEmployeeArchived(ID, archive)).toEqual({ success: true });

    expect(rpcMock).toHaveBeenCalledWith("set_employee_archived", { p_employee_id: ID, p_archived: archive });
    for (const path of ["/admin/employees", "/admin/dashboard", "/admin/calendar", "/admin/bookings", `/admin/employees/${ID}`]) {
      expect(revalidatePathMock).toHaveBeenCalledWith(path);
    }
  });

  it("names the jobs that still need the employee", async () => {
    rpcReturns({ status: "has_upcoming", booking_numbers: [1042, 1050] });
    expect(await setEmployeeArchived(ID, true)).toEqual({
      success: false,
      error: "They're still on #1042 and #1050. Reassign those jobs or finish them first.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("uses the singular for one job", async () => {
    rpcReturns({ status: "has_upcoming", booking_numbers: [1042] });
    expect(await setEmployeeArchived(ID, true)).toEqual({
      success: false,
      error: "They're still on #1042. Reassign that job or finish it first.",
    });
  });

  it("reports a missing employee", async () => {
    rpcReturns({ status: "not_found" });
    expect(await setEmployeeArchived(ID, true)).toEqual({ success: false, error: "That employee doesn't exist." });
  });

  it.each([["not-a-uuid", true], ["", true], [ID, "yes"], [ID, undefined]])(
    "refuses bad arguments (%j, %j) before any query",
    async (id, archived) => {
      const result = await setEmployeeArchived(id as string, archived as boolean);
      expect(result).toEqual({ success: false, error: "That employee doesn't exist." });
      expect(rpcMock).not.toHaveBeenCalled();
    },
  );

  it("fails closed when the migration hasn't been applied", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await setEmployeeArchived(ID, true)).toEqual({ success: false, error: "Something went wrong. Please try again." });
    expect(errorSpy).toHaveBeenCalledWith("setEmployeeArchived failed", { code: "PGRST202", correlationId: expect.any(String) });
    errorSpy.mockRestore();
  });
});
