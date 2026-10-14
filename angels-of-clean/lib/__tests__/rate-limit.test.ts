import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestHeaders),
}));

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };
const rpcMock = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<RpcResult>>(() =>
  Promise.resolve({ data: true, error: null }),
);
vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({ rpc: rpcMock }),
}));

import { allowPublicBooking, BOOKING_RATE_LIMIT } from "../rate-limit";

function bucketOfLastCall(): string {
  return rpcMock.mock.calls.at(-1)![1].p_bucket as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret");
  requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.7" });
  rpcMock.mockResolvedValue({ data: true, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("allowPublicBooking", () => {
  it("asks the database to count one hit against the configured limit and window", async () => {
    expect(await allowPublicBooking()).toBe(true);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("check_rate_limit", {
      p_bucket: expect.stringMatching(/^booking:[0-9a-f]{64}$/),
      p_limit: BOOKING_RATE_LIMIT.limit,
      p_window_seconds: BOOKING_RATE_LIMIT.windowSeconds,
    });
  });

  it("refuses once the database reports the caller is over the limit", async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    expect(await allowPublicBooking()).toBe(false);
  });

  it("never sends the raw IP address to the database", async () => {
    await allowPublicBooking();

    expect(JSON.stringify(rpcMock.mock.calls)).not.toContain("203.0.113.7");
  });

  it("gives the same IP the same bucket and different IPs different buckets", async () => {
    await allowPublicBooking();
    const first = bucketOfLastCall();

    await allowPublicBooking();
    expect(bucketOfLastCall()).toBe(first);

    requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.8" });
    await allowPublicBooking();
    expect(bucketOfLastCall()).not.toBe(first);
  });

  it("uses the first address in a forwarded chain, then x-real-ip, then a shared bucket", async () => {
    await allowPublicBooking();
    const direct = bucketOfLastCall();

    requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" });
    await allowPublicBooking();
    expect(bucketOfLastCall()).toBe(direct);

    requestHeaders = new Headers({ "x-real-ip": "203.0.113.7" });
    await allowPublicBooking();
    expect(bucketOfLastCall()).toBe(direct);

    // No address at all: every such caller shares one bucket rather than going unlimited.
    requestHeaders = new Headers();
    await allowPublicBooking();
    const unknown = bucketOfLastCall();
    expect(unknown).not.toBe(direct);
    await allowPublicBooking();
    expect(bucketOfLastCall()).toBe(unknown);
  });

  it("fails open, logging only the error code, when the limiter is unavailable", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // e.g. supabase/004_rate_limits.sql has not been run yet.
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function check_rate_limit not found for 203.0.113.7" },
    });

    expect(await allowPublicBooking()).toBe(true);

    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("PGRST202");
    expect(logged).not.toContain("203.0.113.7");
    consoleSpy.mockRestore();
  });

  it("fails open when the limiter throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockRejectedValue(new Error("network down"));

    expect(await allowPublicBooking()).toBe(true);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("skips the limiter in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(await allowPublicBooking()).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
