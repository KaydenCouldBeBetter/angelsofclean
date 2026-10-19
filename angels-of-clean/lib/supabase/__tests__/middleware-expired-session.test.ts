import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "../middleware";
import { AUTH_TIMEOUT_MS } from "../auth-timeout";

// The real Supabase client, not a mock: this is the path that hung for
// 25–51 s (PERFORMANCE_DIAGNOSIS.md, cause 2). An expired access token makes
// getClaims() refresh first, and auth-js retries a failed refresh for 30 s.

const b64url = (value: string) => Buffer.from(value).toString("base64url");

function expiredSessionCookie() {
  const expiredAt = Math.floor(Date.now() / 1000) - 60;
  const jwt = [
    b64url(JSON.stringify({ alg: "ES256", typ: "JWT", kid: "test-key" })),
    b64url(JSON.stringify({ sub: "u1", exp: expiredAt, app_metadata: { role: "admin" } })),
    "c2lnbmF0dXJl",
  ].join(".");
  const session = {
    access_token: jwt,
    refresh_token: "refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiredAt,
    user: { id: "u1", app_metadata: { role: "admin" }, user_metadata: {}, aud: "authenticated" },
  };
  return `sb-projref-auth-token=base64-${b64url(JSON.stringify(session))}`;
}

function requestWithExpiredSession() {
  return new NextRequest("https://angelsofclean.example/admin/dashboard", {
    headers: { cookie: expiredSessionCookie() },
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projref.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function sessionAfter(ms: number) {
  let settled: unknown = "pending";
  void updateSession(requestWithExpiredSession()).then(({ session }) => (settled = session));
  await vi.advanceTimersByTimeAsync(ms);
  return settled;
}

describe("updateSession with an expired session", () => {
  it("returns unavailable within the timeout when the refresh never answers", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    expect(await sessionAfter(AUTH_TIMEOUT_MS)).toEqual({ state: "unavailable" });
    // It really was the token refresh that stalled.
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("grant_type=refresh_token");
  });

  it("returns unavailable within the timeout while auth-js keeps retrying a failing refresh", async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new TypeError("fetch failed")));
    vi.stubGlobal("fetch", fetchMock);

    expect(await sessionAfter(AUTH_TIMEOUT_MS)).toEqual({ state: "unavailable" });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("never treats the expired token's admin claim as signed in", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const settled = await sessionAfter(AUTH_TIMEOUT_MS * 2);
    expect(settled).not.toMatchObject({ state: "signed-in" });
  });
});
