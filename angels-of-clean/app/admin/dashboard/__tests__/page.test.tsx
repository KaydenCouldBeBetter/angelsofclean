import { beforeEach, describe, expect, it, vi } from "vitest";
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

const getBookingSettings = vi.fn();
vi.mock("@/lib/supabase/booking-settings", () => ({ getBookingSettings: () => getBookingSettings() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import AdminDashboardPage from "../page";

const SETTINGS = { paused: false, pauseMessage: "", minNoticeHours: 0, maxDaysAhead: 6, updatedAt: "2026-11-13T12:00:00Z", updatedBy: null };

beforeEach(() => getBookingSettings.mockResolvedValue({ ok: true, data: SETTINGS }));

describe("dashboard Active Employees card", () => {
  it("says how many employees have no jobs today, not that they are unavailable", async () => {
    const html = renderToStaticMarkup(await AdminDashboardPage());
    expect(html).toContain("0/5");
    expect(html).not.toContain("unavailable");
    expect(html).toContain("5 with no jobs today");
  });
});

describe("dashboard online booking banner", () => {
  const render = async () =>
    new DOMParser().parseFromString(renderToStaticMarkup(await AdminDashboardPage()), "text/html");

  it("says online booking is paused, in words and with a link to resume, when it is", async () => {
    getBookingSettings.mockResolvedValue({ ok: true, data: { ...SETTINGS, paused: true } });
    const doc = await render();
    const banner = doc.querySelector('[role="status"]')!;
    expect(banner.textContent).toContain("Online booking is paused.");
    expect(banner.querySelector("a")!.getAttribute("href")).toBe("/admin/settings");
  });

  it("shows nothing when booking is open", async () => {
    expect((await render()).querySelector('[role="status"]')).toBeNull();
  });

  it("shows nothing, and still shows the dashboard, when the setting can't be read", async () => {
    getBookingSettings.mockResolvedValue({ ok: false });
    const doc = await render();
    expect(doc.querySelector('[role="status"]')).toBeNull();
    expect(doc.body.textContent).toContain("Active Employees");
  });
});
