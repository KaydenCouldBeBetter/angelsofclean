import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

const getClaims = vi.fn();
const getUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims, getUser } }),
}));

import { updateSession } from "../middleware";
import { AUTH_TIMEOUT_MS } from "../auth-timeout";

const request = () => new NextRequest("https://angelsofclean.example/admin/dashboard");
const claims = (extra: Record<string, unknown>) => ({
  data: { claims: { sub: "u1", ...extra }, header: {}, signature: new Uint8Array() },
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateSession", () => {
  it("reads the role from the verified token's app_metadata without calling Auth's /user", async () => {
    getClaims.mockResolvedValue(claims({ app_metadata: { role: "admin" } }));

    const { session } = await updateSession(request());

    expect(session).toEqual({ state: "signed-in", role: "admin" });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("ignores the client-editable user_metadata", async () => {
    getClaims.mockResolvedValue(
      claims({ app_metadata: {}, user_metadata: { role: "admin" } }),
    );

    const { session } = await updateSession(request());

    expect(session).toEqual({ state: "signed-in", role: undefined });
  });

  it("reports no session as signed out", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect((await updateSession(request())).session).toEqual({ state: "signed-out" });
  });

  it("reports a token that fails verification as signed out", async () => {
    getClaims.mockResolvedValue({
      data: null,
      error: new AuthApiError("Invalid Refresh Token: Refresh Token Not Found", 400, "refresh_token_not_found"),
    });
    expect((await updateSession(request())).session).toEqual({ state: "signed-out" });
  });

  it("reports a network or 5xx failure as unavailable, not signed out", async () => {
    getClaims.mockResolvedValue({
      data: null,
      error: new AuthRetryableFetchError("fetch failed", 0),
    });
    expect((await updateSession(request())).session).toEqual({ state: "unavailable" });
  });

  describe("when Auth is slow", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("stops waiting at the timeout and reports unavailable", async () => {
      getClaims.mockReturnValue(new Promise(() => {}));

      let settled: unknown = "pending";
      void updateSession(request()).then(({ session }) => (settled = session));

      await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS - 1);
      expect(settled).toBe("pending");
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toEqual({ state: "unavailable" });
    });
  });
});
