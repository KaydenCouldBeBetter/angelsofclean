import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { BookingControls } from "@/lib/supabase/booking-settings";

type Result = { success: true } | { success: false; error: string };
type Preview = { success: true; bookings: number } | { success: false; error: string };
const saveBookingSettings = vi.fn<(...a: unknown[]) => Promise<Result>>();
const addBlackoutDate = vi.fn<(...a: unknown[]) => Promise<Result>>();
const removeBlackoutDate = vi.fn<(...a: unknown[]) => Promise<Result>>();
const previewBlackoutDate = vi.fn<(...a: unknown[]) => Promise<Preview>>();
vi.mock("../booking-actions", () => ({
  saveBookingSettings: (...a: unknown[]) => saveBookingSettings(...a),
  addBlackoutDate: (...a: unknown[]) => addBlackoutDate(...a),
  removeBlackoutDate: (...a: unknown[]) => removeBlackoutDate(...a),
  previewBlackoutDate: (...a: unknown[]) => previewBlackoutDate(...a),
}));

import OnlineBookingSection from "../OnlineBookingSection";

const OK: Result = { success: true };
const CONTROLS: BookingControls = {
  settings: {
    paused: false,
    pauseMessage: "",
    minNoticeHours: 0,
    maxDaysAhead: 6,
    updatedAt: "2026-11-13T15:00:00Z",
    updatedBy: "kay@example.com",
  },
  blackouts: [{ day: "2026-11-26", label: "Thanksgiving", createdBy: "kay@example.com" }],
  audit: [{ id: "a1", description: "Closed Thu, Nov 26, 2026 (Thanksgiving)", actor: "kay@example.com", createdAt: "2026-11-13T15:00:00Z" }],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  saveBookingSettings.mockResolvedValue(OK);
  addBlackoutDate.mockResolvedValue(OK);
  removeBlackoutDate.mockResolvedValue(OK);
  previewBlackoutDate.mockResolvedValue({ success: true, bookings: 0 });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (controls: BookingControls = CONTROLS) =>
  act(() => root.render(<OnlineBookingSection controls={controls} today="2026-11-13" />));
const section = (id: string) => container.querySelector<HTMLElement>(`section[aria-labelledby="${id}-heading"]`)!;
const button = (within: ParentNode, text: string) =>
  [...within.querySelectorAll("button")].find((b) => b.textContent?.replace(/\s+/g, " ").includes(text)) as HTMLButtonElement | undefined;
async function click(el: Element | null | undefined) {
  if (!el) throw new Error("element not found");
  await act(async () => {
    (el as HTMLElement).click();
  });
}
function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
async function changeAsync(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit(form: Element) {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
const selectByLabel = (label: string) => {
  const l = [...container.querySelectorAll("label")].find((x) => x.textContent === label)!;
  return document.getElementById(l.htmlFor) as HTMLSelectElement;
};
const status = (within: ParentNode) => within.querySelector('[role="status"]')!.textContent;

describe("online booking settings form", () => {
  const form = () => section("online-booking").closest("form")!;

  it("starts from the saved values and says who last changed them", () => {
    mount({ ...CONTROLS, settings: { ...CONTROLS.settings, paused: true, pauseMessage: "Back Monday.", minNoticeHours: 24, maxDaysAhead: 30 } });
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(container.querySelector("textarea")!.value).toBe("Back Monday.");
    expect(selectByLabel("Minimum notice").value).toBe("24");
    expect(selectByLabel("Customers can book up to").value).toBe("30");
    expect(container.textContent).toContain("Last changed by kay@example.com on Nov 13, 10:00 AM");
  });

  it("saves exactly what was chosen", async () => {
    mount();
    await click(container.querySelector('input[type="checkbox"]'));
    setValue(container.querySelector("textarea")!, "Closed for the week.");
    setValue(selectByLabel("Minimum notice"), "12");
    setValue(selectByLabel("Customers can book up to"), "14");
    await submit(form());
    expect(saveBookingSettings).toHaveBeenCalledWith({
      paused: true,
      pauseMessage: "Closed for the week.",
      minNoticeHours: 12,
      maxDaysAhead: 14,
    });
  });

  it("says plainly that booking is paused after saving a pause, and otherwise how soon customers see it", async () => {
    mount();
    await click(container.querySelector('input[type="checkbox"]'));
    await submit(form());
    expect(status(section("online-booking"))).toContain("Online booking is paused");

    await click(container.querySelector('input[type="checkbox"]'));
    await submit(form());
    expect(status(section("online-booking"))).toContain("within about 30 seconds");
  });

  it("shows the error and no 'saved' when saving fails", async () => {
    saveBookingSettings.mockResolvedValue({ success: false, error: "Something went wrong. Please try again." });
    mount();
    await submit(form());
    expect(section("online-booking").querySelector('[role="alert"]')!.textContent).toBe("Something went wrong. Please try again.");
    expect(status(section("online-booking"))).toBe("");
  });

  it("takes back the 'saved' message as soon as anything changes", async () => {
    mount();
    await submit(form());
    expect(status(section("online-booking"))).not.toBe("");
    setValue(selectByLabel("Minimum notice"), "4");
    expect(status(section("online-booking"))).toBe("");
  });

  it("counts the message against its limit and shows the standard wording used when it's blank", () => {
    mount();
    expect(container.textContent).toContain("0/200");
    expect(container.textContent).toContain("(315) 516-1266");
    setValue(container.querySelector("textarea")!, "Hello");
    expect(container.textContent).toContain("5/200");
    expect(container.querySelector("textarea")!.maxLength).toBe(200);
  });

  it("offers only the minimum notice and day limits the server accepts", () => {
    mount();
    const values = (select: HTMLSelectElement) => [...select.options].map((o) => Number(o.value));
    expect(values(selectByLabel("Minimum notice"))).toEqual([0, 2, 4, 12, 24, 48, 72]);
    expect(values(selectByLabel("Customers can book up to"))).toEqual([3, 6, 7, 14, 21, 30, 45, 60, 92]);
  });

  it("explains what the pause does, including that quotes stay open", () => {
    mount();
    expect(container.textContent).toContain("Commercial quote requests stay open");
    expect(container.textContent).toContain("Bookings you create yourself are never held to these rules");
  });

  it("disables Save while saving", async () => {
    let finish!: (r: Result) => void;
    saveBookingSettings.mockReturnValue(new Promise<Result>((resolve) => (finish = resolve)));
    mount();
    act(() => {
      form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(button(form(), "Saving")?.disabled).toBe(true);
    await act(async () => finish(OK));
    expect(button(form(), "Save online booking settings")?.disabled).toBe(false);
  });
});

describe("closed days", () => {
  const days = () => section("closed-days");
  const dateInput = () => days().querySelector<HTMLInputElement>('input[type="date"]')!;
  const labelInput = () =>
    document.getElementById(
      [...days().querySelectorAll("label")].find((l) => l.textContent === "Label (optional)")!.htmlFor,
    ) as HTMLInputElement;

  it("lists each closed day with its label", () => {
    mount();
    expect(days().textContent).toContain("Thu, Nov 26, 2026");
    expect(days().textContent).toContain("Thanksgiving");
  });

  it("limits the date picker to today onward", () => {
    mount();
    expect(dateInput().min).toBe("2026-11-13");
  });

  it("disables Close this day until a date is chosen", async () => {
    mount();
    expect(button(days(), "Close this day")!.disabled).toBe(true);
    await changeAsync(dateInput(), "2026-12-25");
    expect(button(days(), "Close this day")!.disabled).toBe(false);
  });

  describe("the bookings a day already has", () => {
    it.each([
      [0, "No bookings are scheduled that day."],
      [1, "1 booking is already scheduled that day. Closing it won't cancel it."],
      [3, "3 bookings are already scheduled that day. Closing it won't cancel them."],
    ])("says so for %i", async (bookings, text) => {
      previewBlackoutDate.mockResolvedValue({ success: true, bookings });
      mount();
      await changeAsync(dateInput(), "2026-12-25");
      expect(previewBlackoutDate).toHaveBeenCalledWith("2026-12-25");
      expect(status(days())).toBe(text);
    });

    it("says it couldn't check, rather than claiming there are none", async () => {
      previewBlackoutDate.mockResolvedValue({ success: false, error: "Something went wrong. Please try again." });
      mount();
      await changeAsync(dateInput(), "2026-12-25");
      expect(status(days())).toBe("We couldn't check for bookings on that day.");
    });

    it("ignores a late answer for a day the admin has moved off", async () => {
      let late!: (r: Preview) => void;
      previewBlackoutDate.mockReturnValueOnce(new Promise<Preview>((resolve) => (late = resolve)));
      previewBlackoutDate.mockResolvedValueOnce({ success: true, bookings: 0 });
      mount();
      await changeAsync(dateInput(), "2026-12-24"); // slow answer
      await changeAsync(dateInput(), "2026-12-25"); // fast answer
      await act(async () => late({ success: true, bookings: 9 })); // the slow one arrives last
      expect(status(days())).toBe("No bookings are scheduled that day.");
    });

    it("clears the count when the date is cleared", async () => {
      previewBlackoutDate.mockResolvedValue({ success: true, bookings: 2 });
      mount();
      await changeAsync(dateInput(), "2026-12-25");
      await changeAsync(dateInput(), "");
      expect(status(days())).toBe("");
    });
  });

  it("closes the day with its label, confirms, and empties the form", async () => {
    mount();
    await changeAsync(dateInput(), "2026-12-25");
    setValue(labelInput(), "Christmas");
    await submit(days().querySelector("form")!);
    expect(addBlackoutDate).toHaveBeenCalledWith({ day: "2026-12-25", label: "Christmas" });
    expect(days().textContent).toContain("Closed Fri, Dec 25, 2026.");
    expect(dateInput().value).toBe("");
    expect(labelInput().value).toBe("");
  });

  it("shows why a day couldn't be closed, and keeps what was typed", async () => {
    addBlackoutDate.mockResolvedValue({ success: false, error: "That date is already closed." });
    mount();
    await changeAsync(dateInput(), "2026-11-26");
    await submit(days().querySelector("form")!);
    expect(days().querySelector('[role="alert"]')!.textContent).toBe("That date is already closed.");
    expect(dateInput().value).toBe("2026-11-26");
  });

  it("reopens a day, naming it for screen readers", async () => {
    mount();
    const reopen = button(days(), "Reopen")!;
    expect(reopen.getAttribute("aria-label")).toBe("Reopen Thu, Nov 26, 2026");
    await click(reopen);
    expect(removeBlackoutDate).toHaveBeenCalledWith("2026-11-26");
    expect(days().textContent).toContain("Reopened Thu, Nov 26, 2026.");
  });

  it("shows a reopen failure", async () => {
    removeBlackoutDate.mockResolvedValue({ success: false, error: "Something went wrong. Please try again." });
    mount();
    await click(button(days(), "Reopen"));
    expect(days().querySelector('[role="alert"]')!.textContent).toBe("Something went wrong. Please try again.");
  });

  it("says nothing is closed when that is so", () => {
    mount({ ...CONTROLS, blackouts: [] });
    expect(days().textContent).toContain("No upcoming days are closed.");
  });

  it("labels every field", () => {
    mount();
    for (const input of days().querySelectorAll<HTMLInputElement>("input")) {
      expect(container.querySelector(`label[for="${input.id}"]`), input.outerHTML).not.toBeNull();
    }
  });
});

describe("recent changes", () => {
  it("lists what changed, who did it and when", () => {
    mount();
    const log = section("recent-changes");
    expect(log.textContent).toContain("Closed Thu, Nov 26, 2026 (Thanksgiving)");
    expect(log.textContent).toContain("kay@example.com · Nov 13, 10:00 AM");
  });

  it("says nothing has changed yet, and copes with an unknown actor", () => {
    mount({ ...CONTROLS, audit: [] });
    expect(section("recent-changes").textContent).toContain("Nothing has been changed yet.");
    mount({ ...CONTROLS, audit: [{ id: "a2", description: "Paused online booking", actor: null, createdAt: "2026-11-13T15:00:00Z" }] });
    expect(section("recent-changes").textContent).toContain("An admin · Nov 13, 10:00 AM");
  });
});
