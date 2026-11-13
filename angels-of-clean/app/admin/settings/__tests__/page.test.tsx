import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_ADMIN_PREFERENCES, type AdminPreferences } from "@/lib/admin-preferences";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// The forms call server actions; here they only render.
vi.mock("../booking-actions", () => ({
  saveBookingSettings: vi.fn(),
  addBlackoutDate: vi.fn(),
  removeBlackoutDate: vi.fn(),
  previewBlackoutDate: vi.fn(),
}));
vi.mock("../actions", () => ({
  savePreferences: vi.fn(),
  saveDisplayName: vi.fn(),
  changePassword: vi.fn(),
  signOutOtherDevices: vi.fn(),
}));

const requireAdminMock = vi.fn();
vi.mock("@/lib/supabase/require-admin", () => ({ requireAdmin: () => requireAdminMock() }));
const readAdminPreferences = vi.fn();
vi.mock("@/lib/supabase/admin-preferences", () => ({
  readAdminPreferences: (...args: unknown[]) => readAdminPreferences(...args),
}));

const readBookingControls = vi.fn();
vi.mock("@/lib/supabase/booking-settings", () => ({
  readBookingControls: (...args: unknown[]) => readBookingControls(...args),
}));

import SettingsPage from "../page";

const CONTROLS = {
  settings: {
    paused: true,
    pauseMessage: "Back Monday.",
    minNoticeHours: 24,
    maxDaysAhead: 30,
    updatedAt: "2026-11-13T15:00:00Z",
    updatedBy: "kay@example.com",
  },
  blackouts: [
    { day: "2026-11-26", label: "Thanksgiving", createdBy: "kay@example.com" },
    { day: "2026-12-25", label: "", createdBy: null },
  ],
  audit: [
    { id: "a1", description: "Paused online booking", actor: "kay@example.com", createdAt: "2026-11-13T15:00:00Z" },
  ],
};

const SAVED: AdminPreferences = {
  landingPage: "calendar",
  calendarView: "month",
  weekStartsOn: "monday",
  calendarStartHour: 6,
  calendarEndHour: 20,
  unassignedListCollapsed: true,
  bookingsDefaultFilter: "upcoming",
};

const SUPABASE = { marker: "session client" };

async function render() {
  const html = renderToStaticMarkup(await SettingsPage());
  return new DOMParser().parseFromString(html, "text/html");
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({
    ok: true,
    supabase: SUPABASE,
    user: { email: "kay@example.com", user_metadata: { full_name: "Kay Dee" } },
  });
  readAdminPreferences.mockResolvedValue({ ok: true, data: SAVED });
  readBookingControls.mockResolvedValue({ ok: true, data: CONTROLS });
});

describe("SettingsPage", () => {
  it("has one h1 and a named card for each group of settings", async () => {
    const doc = await render();
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    const names = [...doc.querySelectorAll("section[aria-labelledby]")].map(
      (s) => doc.getElementById(s.getAttribute("aria-labelledby")!)!.textContent,
    );
    expect(names).toEqual([
      "Start page",
      "Calendar",
      "Bookings",
      "Online booking",
      "Closed days",
      "Recent changes",
      "Account & security",
    ]);
  });

  it("reads the preferences with the admin's own session", async () => {
    await render();
    expect(readAdminPreferences).toHaveBeenCalledWith(SUPABASE);
  });

  it("shows the saved preferences, not the defaults", async () => {
    const doc = await render();
    const checked = (name: string) =>
      doc.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
    expect(checked("landingPage")).toBe("calendar");
    expect(checked("calendarView")).toBe("month");
    expect(checked("weekStartsOn")).toBe("monday");
    expect(doc.querySelector<HTMLInputElement>('input[type="checkbox"]:checked')).not.toBeNull();

    const selected = [...doc.querySelectorAll<HTMLSelectElement>("select")].map((s) => s.selectedOptions[0].textContent);
    expect(selected).toEqual(["6:00 AM", "8:00 PM", "Upcoming", "24 hours (1 day)", "30 days"]);
  });

  it("shows the defaults for an admin who has never saved", async () => {
    readAdminPreferences.mockResolvedValue({ ok: true, data: DEFAULT_ADMIN_PREFERENCES });
    const doc = await render();
    expect(doc.querySelector<HTMLInputElement>('input[name="landingPage"]:checked')?.value).toBe("dashboard");
    expect(doc.querySelector<HTMLInputElement>('input[name="calendarView"]:checked')?.value).toBe("week");
  });

  it("gives every control a label", async () => {
    const doc = await render();
    const controls = [...doc.querySelectorAll<HTMLElement>("input:not([type=hidden]), select")];
    expect(controls.length).toBeGreaterThan(8);
    for (const control of controls) {
      const labelled =
        control.closest("label") !== null ||
        (control.id !== "" && doc.querySelector(`label[for="${control.id}"]`) !== null);
      expect(labelled, control.outerHTML).toBe(true);
    }
  });

  it("groups each set of radio buttons under a legend", async () => {
    const doc = await render();
    for (const name of ["landingPage", "calendarView", "weekStartsOn"]) {
      const fieldset = doc.querySelector(`input[name="${name}"]`)!.closest("fieldset")!;
      expect(fieldset.querySelector("legend")?.textContent).toBeTruthy();
    }
  });

  it("has a Save button for the preferences, and one result line for screen readers", async () => {
    const doc = await render();
    expect(doc.body.textContent).toContain("Save preferences");
    expect(doc.querySelector('[role="status"]')).not.toBeNull();
  });

  it("shows the account: email, saved name, password change and sign out elsewhere", async () => {
    const doc = await render();
    expect(doc.body.textContent).toContain("Signed in as kay@example.com");
    expect(doc.querySelector<HTMLInputElement>("#display-name")!.value).toBe("Kay Dee");
    expect(doc.querySelector<HTMLInputElement>("#current-password")!.autocomplete).toBe("current-password");
    expect(doc.querySelector<HTMLInputElement>("#new-password")!.autocomplete).toBe("new-password");
    expect(doc.body.textContent).toContain("Sign out other devices");
  });

  it("leaves the name blank when none was saved, instead of showing the email's start as if saved", async () => {
    requireAdminMock.mockResolvedValue({
      ok: true,
      supabase: SUPABASE,
      user: { email: "kay@example.com", user_metadata: {} },
    });
    const doc = await render();
    expect(doc.querySelector<HTMLInputElement>("#display-name")!.value).toBe("");
  });

  it("says so, and still shows the account, when the preferences can't be loaded", async () => {
    readAdminPreferences.mockResolvedValue({ ok: false });
    const doc = await render();
    expect(doc.querySelector('[role="alert"]')?.textContent).toContain("We couldn't load your preferences");
    expect(doc.body.textContent).not.toContain("Save preferences");
    expect(doc.querySelector("#display-name")).not.toBeNull();
  });

  describe("online booking", () => {
    it("reads the controls with the admin's session and New York's today", async () => {
      await render();
      expect(readBookingControls).toHaveBeenCalledWith(SUPABASE, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    });

    it("shows the saved pause, message, notice and day limit", async () => {
      const doc = await render();
      const section = doc.querySelector('section[aria-labelledby="online-booking-heading"]')!;
      expect(section.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
      expect(section.querySelector("textarea")!.value).toBe("Back Monday.");
      expect(section.textContent).toContain("Last changed by kay@example.com");
    });

    it("lists the closed days with their labels, and a labelled Reopen button for each", async () => {
      const doc = await render();
      const list = doc.querySelector('section[aria-labelledby="closed-days-heading"]')!;
      expect(list.textContent).toContain("Thu, Nov 26, 2026");
      expect(list.textContent).toContain("Thanksgiving");
      expect(list.textContent).toContain("Fri, Dec 25, 2026");
      const reopen = [...list.querySelectorAll("button")].filter((b) => b.textContent === "Reopen");
      expect(reopen.map((b) => b.getAttribute("aria-label"))).toEqual([
        "Reopen Thu, Nov 26, 2026",
        "Reopen Fri, Dec 25, 2026",
      ]);
    });

    it("limits the date picker to today onward", async () => {
      const doc = await render();
      const min = doc.querySelector<HTMLInputElement>('input[type="date"]')!.min;
      expect(min).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("shows the recent changes, who made them and when", async () => {
      const doc = await render();
      const log = doc.querySelector('section[aria-labelledby="recent-changes-heading"]')!;
      expect(log.textContent).toContain("Paused online booking");
      expect(log.textContent).toContain("kay@example.com");
      expect(log.textContent).toContain("Nov 13, 10:00 AM"); // 15:00Z, New York time
    });

    it("says there is nothing closed or changed yet when that is so", async () => {
      readBookingControls.mockResolvedValue({ ok: true, data: { ...CONTROLS, blackouts: [], audit: [] } });
      const doc = await render();
      expect(doc.body.textContent).toContain("No upcoming days are closed.");
      expect(doc.body.textContent).toContain("Nothing has been changed yet.");
    });

    it("says so, and keeps the rest of the page, when the controls can't be loaded", async () => {
      readBookingControls.mockResolvedValue({ ok: false });
      const doc = await render();
      const alerts = [...doc.querySelectorAll('[role="alert"]')].map((a) => a.textContent);
      expect(alerts.join(" ")).toContain("We couldn't load the online booking settings");
      expect(doc.querySelector('section[aria-labelledby="online-booking-heading"]')).toBeNull();
      expect(doc.body.textContent).toContain("Save preferences");
      expect(doc.querySelector("#display-name")).not.toBeNull();
    });
  });

  it("shows a load error, and no settings, when the session can't be verified", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "We couldn't verify your sign-in. Try again." });
    const doc = await render();
    expect(doc.body.textContent).toContain("We couldn't load your settings");
    expect(doc.querySelector("form")).toBeNull();
    expect(readAdminPreferences).not.toHaveBeenCalled();
    expect(readBookingControls).not.toHaveBeenCalled();
  });
});

// Email and SMS still can't be sent (no domain), so notifications stay a labelled
// placeholder rather than a control that pretends to save.
describe("notifications", () => {
  it("is labelled coming soon, with every toggle disabled and off", async () => {
    const doc = await render();
    const fieldset = doc.querySelector<HTMLFieldSetElement>("fieldset[disabled]")!;
    expect(fieldset.querySelector("legend")?.textContent).toContain("Notifications");
    expect(fieldset.querySelector("legend")?.textContent).toContain("Coming soon");
    const status = doc.getElementById(fieldset.getAttribute("aria-describedby")!);
    expect(status?.textContent).toContain("aren't available yet");

    const toggles = fieldset.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect(toggles).toHaveLength(2);
    toggles.forEach((t) => expect(t.checked).toBe(false));
    expect(fieldset.querySelector("button")).toBeNull();
  });
});
