import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_ADMIN_PREFERENCES } from "@/lib/admin-preferences";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../../NewBookingModal", () => ({ NewBookingButton: () => null }));

const getJobsByDateFilter = vi.fn();
const getEmployees = vi.fn();
vi.mock("@/lib/supabase/queries", () => ({
  getJobsByDateFilter: (...a: unknown[]) => getJobsByDateFilter(...a),
  getEmployees: () => getEmployees(),
}));
const getAdminPreferencesOrDefaults = vi.fn();
vi.mock("@/lib/supabase/admin-preferences", () => ({
  getAdminPreferencesOrDefaults: () => getAdminPreferencesOrDefaults(),
}));

import AdminBookingsPage from "../page";

async function render(filter?: string) {
  const html = renderToStaticMarkup(await AdminBookingsPage({ searchParams: Promise.resolve({ filter }) }));
  return new DOMParser().parseFromString(html, "text/html");
}

beforeEach(() => {
  vi.clearAllMocks();
  getJobsByDateFilter.mockResolvedValue({ ok: true, data: [] });
  getEmployees.mockResolvedValue({ ok: true, data: [] });
  getAdminPreferencesOrDefaults.mockResolvedValue(DEFAULT_ADMIN_PREFERENCES);
});

describe("AdminBookingsPage default filter", () => {
  it("uses the admin's own default when no filter is chosen", async () => {
    getAdminPreferencesOrDefaults.mockResolvedValue({ ...DEFAULT_ADMIN_PREFERENCES, bookingsDefaultFilter: "upcoming" });
    const doc = await render();
    expect(getJobsByDateFilter).toHaveBeenCalledWith("upcoming");
    // The tab for the filter in use is the one with the brand fill.
    expect(doc.querySelector("a.bg-primary")?.textContent).toMatch(/upcoming/i);
  });

  it("starts on Today for an admin with nothing saved, as before", async () => {
    await render();
    expect(getJobsByDateFilter).toHaveBeenCalledWith("today");
  });

  it("lets a tab the admin clicked beat the default, without reading the default at all", async () => {
    getAdminPreferencesOrDefaults.mockResolvedValue({ ...DEFAULT_ADMIN_PREFERENCES, bookingsDefaultFilter: "all" });
    for (const tab of ["today", "upcoming", "past", "all"]) {
      getJobsByDateFilter.mockClear();
      await render(tab);
      expect(getJobsByDateFilter).toHaveBeenCalledWith(tab);
    }
    expect(getAdminPreferencesOrDefaults).not.toHaveBeenCalled();
  });

  it("treats an unknown filter in the URL as no choice, and never passes it to the query", async () => {
    getAdminPreferencesOrDefaults.mockResolvedValue({ ...DEFAULT_ADMIN_PREFERENCES, bookingsDefaultFilter: "past" });
    await render("cancelled; drop table bookings");
    expect(getJobsByDateFilter).toHaveBeenCalledTimes(1);
    expect(getJobsByDateFilter).toHaveBeenCalledWith("past");
  });

  it("still shows the bookings when the preferences couldn't be read (the helper returns defaults)", async () => {
    const doc = await render();
    expect(doc.body.textContent).not.toContain("We couldn't load");
  });
});
