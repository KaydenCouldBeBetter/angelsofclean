import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DEFAULT_ADMIN_PREFERENCES, TRAY_COLLAPSED_KEY, type AdminPreferences } from "@/lib/admin-preferences";
import { ADMIN_DISPLAY_NAME_EVENT } from "@/lib/admin-display-name";

type Result = { success: true } | { success: false; error: string };
const savePreferences = vi.fn<(...a: unknown[]) => Promise<Result>>();
const saveDisplayName = vi.fn<(...a: unknown[]) => Promise<Result>>();
const changePassword = vi.fn<(...a: unknown[]) => Promise<Result>>();
const signOutOtherDevices = vi.fn<(...a: unknown[]) => Promise<Result>>();
vi.mock("../actions", () => ({
  savePreferences: (...a: unknown[]) => savePreferences(...a),
  saveDisplayName: (...a: unknown[]) => saveDisplayName(...a),
  changePassword: (...a: unknown[]) => changePassword(...a),
  signOutOtherDevices: (...a: unknown[]) => signOutOtherDevices(...a),
}));

import PreferencesForm from "../PreferencesForm";
import AccountSection from "../AccountSection";

const OK: Result = { success: true };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  for (const action of [savePreferences, saveDisplayName, changePassword, signOutOtherDevices]) {
    action.mockResolvedValue(OK);
  }
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});

const render = (ui: React.ReactElement) => act(() => root.render(ui));
const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.replace(/\s+/g, " ").includes(text)) as
    | HTMLButtonElement
    | undefined;
async function click(el: Element | null | undefined) {
  if (!el) throw new Error("element not found");
  await act(async () => {
    (el as HTMLElement).click();
  });
}
function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const radio = (name: string, value: string) =>
  container.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!;
const field = <T extends HTMLElement = HTMLInputElement>(id: string) => container.querySelector<T>(`#${id}`)!;
const selectByLabel = (label: string) => {
  const l = [...container.querySelectorAll("label")].find((x) => x.textContent === label)!;
  return field<HTMLSelectElement>(l.htmlFor);
};
async function submit(form?: Element | null) {
  await act(async () => {
    (form ?? container.querySelector("form")!).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
const status = () => container.querySelector('[role="status"]')!.textContent;
const alert = () => container.querySelector('[role="alert"]');

describe("PreferencesForm", () => {
  const mount = (initial: AdminPreferences = DEFAULT_ADMIN_PREFERENCES) => render(<PreferencesForm initial={initial} />);

  it("saves exactly what was chosen, then says so", async () => {
    mount();
    await click(radio("landingPage", "calendar"));
    await click(radio("calendarView", "month"));
    await click(radio("weekStartsOn", "monday"));
    setValue(selectByLabel("From"), "6");
    setValue(selectByLabel("Until"), "20");
    await click(container.querySelector('input[type="checkbox"]'));
    setValue(selectByLabel("Show these bookings first"), "upcoming");

    expect(status()).toBe("");
    await submit();

    expect(savePreferences).toHaveBeenCalledWith({
      landingPage: "calendar",
      calendarView: "month",
      weekStartsOn: "monday",
      calendarStartHour: 6,
      calendarEndHour: 20,
      unassignedListCollapsed: true,
      bookingsDefaultFilter: "upcoming",
    });
    expect(status()).toBe("Preferences saved.");
    expect(alert()).toBeNull();
  });

  it("starts from the saved values", () => {
    mount({ ...DEFAULT_ADMIN_PREFERENCES, landingPage: "bookings", weekStartsOn: "monday" });
    expect(radio("landingPage", "bookings").checked).toBe(true);
    expect(radio("weekStartsOn", "monday").checked).toBe(true);
    expect(selectByLabel("From").value).toBe("7");
    expect(selectByLabel("Until").value).toBe("17");
  });

  it("offers midnight only as an end hour", () => {
    mount();
    const labels = (s: HTMLSelectElement) => [...s.options].map((o) => o.textContent);
    expect(labels(selectByLabel("From"))).toHaveLength(24);
    expect(labels(selectByLabel("From"))).not.toContain("12:00 AM (midnight)");
    expect(labels(selectByLabel("Until"))).toHaveLength(24);
    expect(labels(selectByLabel("Until")).at(-1)).toBe("12:00 AM (midnight)");
  });

  it("clears this browser's calendar hide/show override once saved, so the new default applies", async () => {
    window.localStorage.setItem(TRAY_COLLAPSED_KEY, "1");
    mount();
    await submit();
    expect(window.localStorage.getItem(TRAY_COLLAPSED_KEY)).toBeNull();
  });

  it("keeps the override when the save fails", async () => {
    window.localStorage.setItem(TRAY_COLLAPSED_KEY, "1");
    savePreferences.mockResolvedValue({ success: false, error: "Something went wrong. Please try again." });
    mount();
    await submit();
    expect(window.localStorage.getItem(TRAY_COLLAPSED_KEY)).toBe("1");
  });

  it("shows the server's error and does not claim it saved", async () => {
    savePreferences.mockResolvedValue({ success: false, error: "Something went wrong. Please try again." });
    mount();
    await submit();
    expect(alert()?.textContent).toBe("Something went wrong. Please try again.");
    expect(status()).toBe("");
  });

  it("warns about hours that are too close, ties the message to both selects, and doesn't save", async () => {
    mount();
    setValue(selectByLabel("From"), "10");
    setValue(selectByLabel("Until"), "12");

    const error = alert()!;
    expect(error.textContent).toBe("Show at least 4 hours on the calendar.");
    for (const label of ["From", "Until"]) {
      const select = selectByLabel(label);
      expect(select.getAttribute("aria-invalid")).toBe("true");
      expect(select.getAttribute("aria-describedby")).toBe(error.id);
    }

    await submit();
    expect(savePreferences).not.toHaveBeenCalled();

    setValue(selectByLabel("Until"), "14");
    expect(alert()).toBeNull();
    expect(selectByLabel("From").getAttribute("aria-invalid")).toBeNull();
    await submit();
    expect(savePreferences).toHaveBeenCalledTimes(1);
  });

  it("takes back the 'saved' message as soon as something changes", async () => {
    mount();
    await submit();
    expect(status()).toBe("Preferences saved.");
    await click(radio("landingPage", "bookings"));
    expect(status()).toBe("");
  });

  it("disables Save while saving, so a double click can't save twice", async () => {
    let finish!: (r: Result) => void;
    savePreferences.mockReturnValue(new Promise<Result>((resolve) => (finish = resolve)));
    mount();
    act(() => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(button("Saving")?.disabled).toBe(true);
    await act(async () => finish(OK));
    expect(button("Save preferences")?.disabled).toBe(false);
    expect(status()).toBe("Preferences saved.");
  });
});

describe("AccountSection", () => {
  const mount = (displayName = "Kay Dee") =>
    render(<AccountSection email="kay@example.com" displayName={displayName} />);
  const forms = () => [...container.querySelectorAll("form")];

  describe("display name", () => {
    it("saves the name and tells the sidebar", async () => {
      const heard = vi.fn();
      window.addEventListener(ADMIN_DISPLAY_NAME_EVENT, (e) => heard((e as CustomEvent).detail), { once: true });
      mount("");
      setValue(field("display-name"), "  Kay   Dee ");
      await submit(forms()[0]);
      expect(saveDisplayName).toHaveBeenCalledWith("  Kay   Dee ");
      expect(heard).toHaveBeenCalledWith("Kay Dee");
      expect(container.textContent).toContain("Name saved.");
    });

    it("tells the sidebar to show the start of the email when the name is cleared", async () => {
      const heard = vi.fn();
      window.addEventListener(ADMIN_DISPLAY_NAME_EVENT, (e) => heard((e as CustomEvent).detail), { once: true });
      mount();
      setValue(field("display-name"), "");
      await submit(forms()[0]);
      expect(heard).toHaveBeenCalledWith("kay");
    });

    it("shows a failure and tells the sidebar nothing", async () => {
      const heard = vi.fn();
      window.addEventListener(ADMIN_DISPLAY_NAME_EVENT, heard, { once: true });
      saveDisplayName.mockResolvedValue({ success: false, error: "That name is too long." });
      mount();
      await submit(forms()[0]);
      expect(alert()?.textContent).toBe("That name is too long.");
      expect(heard).not.toHaveBeenCalled();
      window.removeEventListener(ADMIN_DISPLAY_NAME_EVENT, heard);
    });
  });

  describe("change password", () => {
    const fill = (current: string, next: string, confirm: string) => {
      setValue(field("current-password"), current);
      setValue(field("new-password"), next);
      setValue(field("confirm-password"), confirm);
    };

    it("does not send mismatched new passwords", async () => {
      mount();
      fill("old password", "a brand new password", "a brand new passwrod");
      await submit(forms()[1]);
      expect(changePassword).not.toHaveBeenCalled();
      expect(alert()?.textContent).toBe("The new passwords don't match.");
    });

    it("sends the current and new password, then empties all three fields", async () => {
      mount();
      fill("old password", "a brand new password", "a brand new password");
      await submit(forms()[1]);
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "old password",
        newPassword: "a brand new password",
      });
      expect(container.textContent).toContain("Password changed.");
      for (const id of ["current-password", "new-password", "confirm-password"]) {
        expect(field(id).value).toBe("");
      }
    });

    it("keeps what was typed and shows the reason when it's refused", async () => {
      changePassword.mockResolvedValue({ success: false, error: "Your current password is incorrect." });
      mount();
      fill("wrong", "a brand new password", "a brand new password");
      await submit(forms()[1]);
      expect(alert()?.textContent).toBe("Your current password is incorrect.");
      expect(field("new-password").value).toBe("a brand new password");
      expect(container.textContent).not.toContain("Password changed.");
    });

    it("labels all three fields", () => {
      mount();
      for (const id of ["display-name", "current-password", "new-password", "confirm-password"]) {
        expect(container.querySelector(`label[for="${id}"]`), id).not.toBeNull();
      }
    });
  });

  describe("sign out other devices", () => {
    it("ends the other sessions and says so", async () => {
      mount();
      await click(button("Sign out other devices"));
      expect(signOutOtherDevices).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain("Every other device has been signed out.");
    });

    it("shows a failure instead", async () => {
      signOutOtherDevices.mockResolvedValue({ success: false, error: "Something went wrong. Please try again." });
      mount();
      await click(button("Sign out other devices"));
      expect(alert()?.textContent).toBe("Something went wrong. Please try again.");
      expect(container.textContent).not.toContain("has been signed out");
    });
  });
});
