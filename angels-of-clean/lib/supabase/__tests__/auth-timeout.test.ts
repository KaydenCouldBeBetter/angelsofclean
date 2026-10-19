import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AUTH_TIMEOUT_MS,
  authRetryTarget,
  authRetryUrl,
  isAuthRetryParams,
  isAuthRetryUrl,
  withAuthTimeout,
} from "../auth-timeout";

describe("withAuthTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits about 4 seconds, well under auth-js's 30 s refresh retries", () => {
    expect(AUTH_TIMEOUT_MS).toBeGreaterThanOrEqual(3000);
    expect(AUTH_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });

  it("passes a prompt answer through and clears its timer", async () => {
    const result = await withAuthTimeout(Promise.resolve("verified"));
    expect(result).toEqual({ timedOut: false, value: "verified" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives up on a call that never answers, at the timeout and not before", async () => {
    let settled: unknown = "pending";
    void withAuthTimeout(new Promise(() => {})).then((r) => (settled = r));

    await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS - 1);
    expect(settled).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual({ timedOut: true });
  });

  it("ignores an answer that arrives after the timeout", async () => {
    let resolveLate!: (v: string) => void;
    const pending = withAuthTimeout(new Promise<string>((r) => (resolveLate = r)));
    await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS);
    resolveLate("admin");
    expect(await pending).toEqual({ timedOut: true });
  });

  it("lets an unexpected error through rather than reading it as a timeout", async () => {
    await expect(withAuthTimeout(Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });
});

describe("auth retry screen URLs", () => {
  it("points at the sign-in page and remembers where the visitor was going", () => {
    const url = authRetryUrl(new URL("https://angelsofclean.example/admin/bookings?filter=past"));
    expect(url.origin).toBe("https://angelsofclean.example");
    expect(url.pathname).toBe("/admin");
    expect(url.searchParams.get("next")).toBe("/admin/bookings?filter=past");
    expect(isAuthRetryUrl(url)).toBe(true);
    expect(isAuthRetryParams(Object.fromEntries(url.searchParams))).toBe(true);
  });

  it("is only the retry screen on /admin itself", () => {
    expect(isAuthRetryUrl(new URL("https://a.example/admin/dashboard?auth=retry"))).toBe(false);
    expect(isAuthRetryUrl(new URL("https://a.example/admin"))).toBe(false);
    expect(isAuthRetryParams({ auth: ["retry", "retry"] })).toBe(false);
  });

  it.each([
    ["/admin/bookings/abc?x=1", "/admin/bookings/abc?x=1"],
    ["/admin/dashboard", "/admin/dashboard"],
    ["/admin", "/admin"],
  ])("follows an admin path: %s", (next, expected) => {
    expect(authRetryTarget(next)).toBe(expected);
  });

  it.each([
    undefined,
    ["/admin/dashboard", "/admin/quotes"],
    "",
    "https://evil.example/admin",
    "//evil.example/admin",
    "/\\evil.example/admin",
    "/admin-but-not-really",
    "/admin/../residential",
    "/residential",
    "admin/dashboard",
    "/admin?auth=retry&next=/admin",
  ])("falls back to /admin for %j", (next) => {
    expect(authRetryTarget(next)).toBe("/admin");
  });
});
