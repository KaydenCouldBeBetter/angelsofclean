import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthRetryableFetchError } from "@supabase/supabase-js";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

import {
  requireAdmin,
  NOT_SIGNED_IN_ERROR,
  NOT_AUTHORIZED_ERROR,
  AUTH_UNAVAILABLE_ERROR,
} from "../require-admin";
import { AUTH_TIMEOUT_MS } from "../auth-timeout";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAdmin", () => {
  it("refuses when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, error: NOT_SIGNED_IN_ERROR });
  });

  it("refuses when token verification errors", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT" },
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, error: NOT_SIGNED_IN_ERROR });
  });

  it("refuses a verified user whose app_metadata has no admin role", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: "user@example.com", app_metadata: {} } },
      error: null,
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, error: NOT_AUTHORIZED_ERROR });
  });

  it("ignores the client-editable user_metadata when deciding the role", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          email: "user@example.com",
          app_metadata: {},
          user_metadata: { role: "admin" },
        },
      },
      error: null,
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, error: NOT_AUTHORIZED_ERROR });
  });

  it("accepts a verified user with app_metadata.role === 'admin'", async () => {
    const user = { email: "admin@example.com", app_metadata: { role: "admin" } };
    getUserMock.mockResolvedValue({ data: { user }, error: null });

    const result = await requireAdmin();

    expect(result).toMatchObject({ ok: true, user });
  });

  it("refuses with a retry message when Auth can't be reached", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError("fetch failed", 0),
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, error: AUTH_UNAVAILABLE_ERROR });
  });

  describe("when Auth is slow", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("refuses at the timeout instead of hanging, even for an admin who answers late", async () => {
      let answer!: (value: unknown) => void;
      getUserMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));

      let settled: unknown = "pending";
      void requireAdmin().then((r) => (settled = r));

      await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS - 1);
      expect(settled).toBe("pending");
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toEqual({ ok: false, error: AUTH_UNAVAILABLE_ERROR });

      answer({ data: { user: { app_metadata: { role: "admin" } } }, error: null });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toEqual({ ok: false, error: AUTH_UNAVAILABLE_ERROR });
    });
  });
});
