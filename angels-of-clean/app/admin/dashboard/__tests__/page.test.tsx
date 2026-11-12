import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// L7: the "Active Employees" card counted employees with no job today as
// "unavailable", which tells the office the opposite of the truth.
vi.mock("../../NewBookingModal", () => ({ NewBookingButton: () => null }));
vi.mock("../JobRowActions", () => ({ default: () => null }));
vi.mock("../../LoadError", () => ({ default: () => null }));
vi.mock("@/lib/supabase/queries", () => ({
  getDashboardStats: () =>
    Promise.resolve({
      ok: true,
      data: { todayJobs: [], totalPending: 0, completedThisWeek: 0, totalEmployees: 5 },
    }),
  getEmployees: () => Promise.resolve({ ok: true, data: [] }),
}));

import AdminDashboardPage from "../page";

describe("dashboard Active Employees card", () => {
  it("says how many employees have no jobs today, not that they are unavailable", async () => {
    const html = renderToStaticMarkup(await AdminDashboardPage());
    expect(html).toContain("0/5");
    expect(html).not.toContain("unavailable");
    expect(html).toContain("5 with no jobs today");
  });
});
