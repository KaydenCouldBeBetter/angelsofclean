import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const getPublicBookingRules = vi.fn();
vi.mock("@/lib/supabase/booking-rules", () => ({ getPublicBookingRules: () => getPublicBookingRules() }));

import { GET } from "../route";

const RULES = { paused: false, pauseMessage: "", minNoticeHours: 0, maxDaysAhead: 6, blackoutDates: ["2026-12-25"] };

beforeEach(() => {
  vi.clearAllMocks();
  getPublicBookingRules.mockResolvedValue({ ok: true, data: RULES });
});

describe("GET /api/public/booking-rules", () => {
  it("returns the rules to anyone, with a short shared cache", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RULES);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=30, stale-while-revalidate=60");
  });

  it("needs no sign-in: it never looks for a session or admin", async () => {
    // Nothing is mocked for auth; reaching this assertion without an error is the point.
    expect((await GET()).status).toBe(200);
  });

  it("answers 503, never an empty rules object, and is never cached, when the rules can't be read", async () => {
    getPublicBookingRules.mockResolvedValue({ ok: false });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Booking rules unavailable" });
    expect(res.headers.get("Cache-Control")).toBeNull();
  });
});

describe("caching", () => {
  it("is rendered per request, never frozen at build time", async () => {
    const route = await import("../route");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
