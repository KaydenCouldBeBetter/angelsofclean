import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
const createPublicClient = vi.fn(() => ({ rpc }));
vi.mock("../public", () => ({ createPublicClient: () => createPublicClient() }));

import { getPublicBookingRules } from "../booking-rules";

const RAW = {
  paused: true,
  pause_message: "Back Monday.",
  min_notice_hours: 12,
  max_days_ahead: 14,
  blackout_dates: ["2026-12-25"],
};

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: RAW, error: null });
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getPublicBookingRules", () => {
  it("returns the rules, read through the signed-out client", async () => {
    expect(await getPublicBookingRules()).toEqual({
      ok: true,
      data: {
        paused: true,
        pauseMessage: "Back Monday.",
        minNoticeHours: 12,
        maxDaysAhead: 14,
        blackoutDates: ["2026-12-25"],
      },
    });
    expect(createPublicClient).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_booking_rules");
  });

  it("reports a database error as a failure, logging only the code", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function does not exist for kay@example.com" } });
    expect(await getPublicBookingRules()).toEqual({ ok: false });
    expect(log).toHaveBeenCalledWith("getPublicBookingRules failed", { code: "42883", correlationId: expect.any(String) });
    expect(JSON.stringify(log.mock.calls)).not.toContain("kay@example.com");
  });

  it("reports an answer of the wrong shape as a failure, never as 'no rules'", async () => {
    for (const data of [null, {}, "paused", { ...RAW, paused: "no" }]) {
      rpc.mockResolvedValue({ data, error: null });
      expect(await getPublicBookingRules()).toEqual({ ok: false });
    }
  });

  it("reports a thrown error (network down) as a failure instead of throwing", async () => {
    rpc.mockRejectedValue(new Error("fetch failed"));
    expect(await getPublicBookingRules()).toEqual({ ok: false });
    createPublicClient.mockImplementationOnce(() => {
      throw new Error("missing env");
    });
    expect(await getPublicBookingRules()).toEqual({ ok: false });
  });
});
