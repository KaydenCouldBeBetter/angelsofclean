import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_ADMIN_PREFERENCES, type AdminPreferences } from "@/lib/admin-preferences";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// The forms call server actions; here they only render.
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

import SettingsPage from "../page";

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
});

describe("SettingsPage", () => {
  it("has one h1 and a named card for each group of settings", async () => {
    const doc = await render();
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    const names = [...doc.querySelectorAll("section[aria-labelledby]")].map(
      (s) => doc.getElementById(s.getAttribute("aria-labelledby")!)!.textContent,
    );
    expect(names).toEqual(["Start page", "Calendar", "Bookings", "Account & security"]);
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
    expect(selected).toEqual(["6:00 AM", "8:00 PM", "Upcoming"]);
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

  it("shows a load error, and no settings, when the session can't be verified", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "We couldn't verify your sign-in. Try again." });
    const doc = await render();
    expect(doc.body.textContent).toContain("We couldn't load your settings");
    expect(doc.querySelector("form")).toBeNull();
    expect(readAdminPreferences).not.toHaveBeenCalled();
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
