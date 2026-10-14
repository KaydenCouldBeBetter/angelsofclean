import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
vi.mock("@/lib/supabase/require-admin", () => ({
  requireAdmin: () => requireAdminMock(),
  NOT_SIGNED_IN_ERROR: "You must be signed in to do this.",
}));

const getJobsInRangeMock = vi.fn();
vi.mock("@/lib/supabase/queries", () => ({
  getJobsInRange: (...args: unknown[]) => getJobsInRangeMock(...args),
}));

import { GET } from "../route";

function request(query: string) {
  return new NextRequest(`http://localhost/api/admin/jobs${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({ ok: true });
});

describe("GET /api/admin/jobs", () => {
  it("returns the jobs for the requested range", async () => {
    getJobsInRangeMock.mockResolvedValue({ ok: true, data: [{ id: "b-1" }] });

    const res = await GET(request("?from=2026-09-01&to=2026-09-30"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "b-1" }]);
    expect(getJobsInRangeMock).toHaveBeenCalledWith("2026-09-01", "2026-09-30");
  });

  it("returns 200 with an empty list when the range genuinely has no jobs", async () => {
    getJobsInRangeMock.mockResolvedValue({ ok: true, data: [] });

    const res = await GET(request("?from=2026-09-01&to=2026-09-30"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 503, not an empty list, when the query fails", async () => {
    getJobsInRangeMock.mockResolvedValue({ ok: false });

    const res = await GET(request("?from=2026-09-01&to=2026-09-30"));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Could not load jobs" });
  });

  it("refuses signed-out and non-admin callers without querying", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "You must be signed in to do this." });
    expect((await GET(request("?from=2026-09-01&to=2026-09-30"))).status).toBe(401);

    requireAdminMock.mockResolvedValue({ ok: false, error: "You are not authorized to do this." });
    expect((await GET(request("?from=2026-09-01&to=2026-09-30"))).status).toBe(403);

    expect(getJobsInRangeMock).not.toHaveBeenCalled();
  });
});
