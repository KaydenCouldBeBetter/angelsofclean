import { beforeEach, describe, expect, it, vi } from "vitest";

type GetUser = { data: { user: unknown }; error: { name?: string; status?: number } | null };
const getUser = vi.fn<() => Promise<GetUser>>();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser } }),
}));

import { requireCustomer } from "../require-customer";
import { AUTH_UNAVAILABLE_ERROR, NOT_SIGNED_IN_ERROR } from "../require-admin";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireCustomer", () => {
  it("accepts any signed-in user, with or without a role", async () => {
    for (const app_metadata of [{}, { role: "admin" }, { role: "other" }]) {
      getUser.mockResolvedValue({ data: { user: { id: "u1", app_metadata } }, error: null });
      const result = await requireCustomer();
      expect(result.ok).toBe(true);
    }
  });

  it("refuses a visitor with no session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await requireCustomer()).toEqual({ ok: false, error: NOT_SIGNED_IN_ERROR });
  });

  it("refuses a token Supabase rejects", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthApiError", status: 401 } });
    expect(await requireCustomer()).toEqual({ ok: false, error: NOT_SIGNED_IN_ERROR });
  });

  it("refuses, with a retry message, when Auth doesn't answer in time", async () => {
    vi.useFakeTimers();
    getUser.mockReturnValue(new Promise(() => {}));
    const pending = requireCustomer();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ ok: false, error: AUTH_UNAVAILABLE_ERROR });
    vi.useRealTimers();
  });
});
