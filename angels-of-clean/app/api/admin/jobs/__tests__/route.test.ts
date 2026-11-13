import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
vi.mock("@/lib/supabase/require-admin", () => ({
  requireAdmin: () => requireAdminMock(),
  NOT_SIGNED_IN_ERROR: "You must be signed in to do this.",
  AUTH_UNAVAILABLE_ERROR: "We couldn't verify your sign-in. Try again.",
}));

const getJobsInRangeMock = vi.fn();
const getEmployeeJobsInRangeMock = vi.fn();
vi.mock("@/lib/supabase/queries", () => ({
  getJobsInRange: (...args: unknown[]) => getJobsInRangeMock(...args),
  getEmployeeJobsInRange: (...args: unknown[]) => getEmployeeJobsInRangeMock(...args),
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

  it("answers 401 to a signed-out caller without querying", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "You must be signed in to do this." });
    expect((await GET(request("?from=2026-09-01&to=2026-09-30"))).status).toBe(401);
    expect(getJobsInRangeMock).not.toHaveBeenCalled();
  });

  it("answers 403 to a signed-in non-admin without querying", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "You are not authorized to do this." });
    expect((await GET(request("?from=2026-09-01&to=2026-09-30"))).status).toBe(403);
    expect(getJobsInRangeMock).not.toHaveBeenCalled();
  });

  it("answers 503, not 403, when Auth is unreachable, without querying", async () => {
    requireAdminMock.mockResolvedValue({
      ok: false,
      error: "We couldn't verify your sign-in. Try again.",
    });
    expect((await GET(request("?from=2026-09-01&to=2026-09-30"))).status).toBe(503);
    expect(getJobsInRangeMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/jobs — submission check", () => {
  it("answers 400, not 503, to dates that aren't YYYY-MM-DD, without querying (L5)", async () => {
    for (const query of ["?from=x&to=y", "?from=2026-02-30&to=2026-03-01", "?from=2026-09-01&to=09/30/2026"]) {
      expect((await GET(request(query))).status).toBe(400);
    }
    expect(getJobsInRangeMock).not.toHaveBeenCalled();
  });

  it("says the dates are invalid, not missing, when both were sent", async () => {
    const res = await GET(request("?from=2026-13-01&to=x"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid/i);
  });

  it("tells caches never to store the jobs, which hold names and addresses (L12)", async () => {
    getJobsInRangeMock.mockResolvedValue({ ok: true, data: [] });
    const res = await GET(request("?from=2026-09-01&to=2026-09-30"));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  describe("with ?employee=", () => {
    const ID = "11111111-1111-4111-8111-111111111111";

    it("returns only that employee's jobs, from the employee query", async () => {
      getEmployeeJobsInRangeMock.mockResolvedValue({ ok: true, data: [{ id: "mine" }] });

      const res = await GET(request(`?from=2026-09-01&to=2026-09-30&employee=${ID}`));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([{ id: "mine" }]);
      expect(getEmployeeJobsInRangeMock).toHaveBeenCalledWith(ID, "2026-09-01", "2026-09-30");
      expect(getJobsInRangeMock).not.toHaveBeenCalled();
    });

    it("answers 400 to an id that isn't a UUID, without querying", async () => {
      const res = await GET(request("?from=2026-09-01&to=2026-09-30&employee=abc"));
      expect(res.status).toBe(400);
      expect(getEmployeeJobsInRangeMock).not.toHaveBeenCalled();
      expect(getJobsInRangeMock).not.toHaveBeenCalled();
    });

    it("answers 400 to an empty id rather than returning everyone's jobs", async () => {
      const res = await GET(request("?from=2026-09-01&to=2026-09-30&employee="));
      expect(res.status).toBe(400);
      expect(getJobsInRangeMock).not.toHaveBeenCalled();
    });

    it("returns 503, not an empty list, when the query fails", async () => {
      getEmployeeJobsInRangeMock.mockResolvedValue({ ok: false });
      expect((await GET(request(`?from=2026-09-01&to=2026-09-30&employee=${ID}`))).status).toBe(503);
    });

    it("still answers 403 to a non-admin without querying", async () => {
      requireAdminMock.mockResolvedValue({ ok: false, error: "You are not authorized to do this." });
      expect((await GET(request(`?from=2026-09-01&to=2026-09-30&employee=${ID}`))).status).toBe(403);
      expect(getEmployeeJobsInRangeMock).not.toHaveBeenCalled();
    });
  });
});
