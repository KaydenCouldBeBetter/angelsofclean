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

import { allowPublicSubmission, SUBMISSION_RATE_LIMIT } from "../rate-limit";

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

describe("allowPublicSubmission", () => {
  it("asks the database to count one hit against the configured limit and window", async () => {
    expect(await allowPublicSubmission("booking")).toBe(true);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("check_rate_limit", {
      p_bucket: expect.stringMatching(/^booking:[0-9a-f]{64}$/),
      p_limit: SUBMISSION_RATE_LIMIT.limit,
      p_window_seconds: SUBMISSION_RATE_LIMIT.windowSeconds,
    });
  });

  it("refuses once the database reports the caller is over the limit", async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    expect(await allowPublicSubmission("booking")).toBe(false);
  });

  it("never sends the raw IP address to the database", async () => {
    await allowPublicSubmission("booking");

    expect(JSON.stringify(rpcMock.mock.calls)).not.toContain("203.0.113.7");
  });

  it("gives the same IP the same bucket and different IPs different buckets", async () => {
    await allowPublicSubmission("booking");
    const first = bucketOfLastCall();

    await allowPublicSubmission("booking");
    expect(bucketOfLastCall()).toBe(first);

    requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.8" });
    await allowPublicSubmission("booking");
    expect(bucketOfLastCall()).not.toBe(first);
  });

  it("counts bookings and quote requests from the same IP separately", async () => {
    await allowPublicSubmission("booking");
    const booking = bucketOfLastCall();

    await allowPublicSubmission("quote");
    const quote = bucketOfLastCall();

    expect(booking).toMatch(/^booking:/);
    expect(quote).toMatch(/^quote:/);
    expect(quote.split(":")[1]).toBe(booking.split(":")[1]);
  });

  it("uses the first address in a forwarded chain, then x-real-ip, then a shared bucket", async () => {
    await allowPublicSubmission("booking");
    const direct = bucketOfLastCall();

    requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" });
    await allowPublicSubmission("booking");
    expect(bucketOfLastCall()).toBe(direct);

    requestHeaders = new Headers({ "x-real-ip": "203.0.113.7" });
    await allowPublicSubmission("booking");
    expect(bucketOfLastCall()).toBe(direct);

    // No address at all: every such caller shares one bucket rather than going unlimited.
    requestHeaders = new Headers();
    await allowPublicSubmission("booking");
    const unknown = bucketOfLastCall();
    expect(unknown).not.toBe(direct);
    await allowPublicSubmission("booking");
    expect(bucketOfLastCall()).toBe(unknown);
  });

  it("fails open, logging only the error code, when the limiter is unavailable", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // e.g. the rate_limits migration has not been applied yet.
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "function check_rate_limit not found for 203.0.113.7" },
    });

    expect(await allowPublicSubmission("booking")).toBe(true);

    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("PGRST202");
    expect(logged).not.toContain("203.0.113.7");
    consoleSpy.mockRestore();
  });

  it("fails open when the limiter throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockRejectedValue(new Error("network down"));

    expect(await allowPublicSubmission("booking")).toBe(true);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it("skips the limiter in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(await allowPublicSubmission("booking")).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
