import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// The New Booking dialog asks for the home size (so the office's own bookings
// count toward the crew limit like customers' do) and warns, without blocking,
// when the chosen day is closed to customers in Settings.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
type Result = { success: boolean; error?: string };
const adminCreateBooking = vi.fn<(...a: unknown[]) => Promise<Result>>();
vi.mock("@/app/actions/submitBooking", () => ({ adminCreateBooking: (...a: unknown[]) => adminCreateBooking(...a) }));

import { NewBookingButton } from "../NewBookingModal";

const RULES = { paused: false, pauseMessage: "", minNoticeHours: 0, maxDaysAhead: 6, blackoutDates: ["2026-12-25"] };
const fetchMock = vi.fn();

let container: HTMLDivElement;
let root: Root;

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const field = (id: string) => document.getElementById(id) as HTMLInputElement & HTMLSelectElement;
function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
async function openDialog() {
  await act(async () => container.querySelector("button")!.click());
  await settle();
}
const warning = () => dialog().querySelector('[role="status"]')!;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(RULES) });
  adminCreateBooking.mockResolvedValue({ success: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<NewBookingButton />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
  vi.unstubAllGlobals();
});

describe("home size in the New Booking dialog", () => {
  it("is a labelled select with the four sizes, 'Not sure' chosen to start", async () => {
    await openDialog();
    expect(dialog().querySelector('label[for="nb-size"]')!.textContent).toBe("Home size");
    expect(field("nb-size").value).toBe("unsure");
    expect([...field("nb-size").options].map((o) => o.value)).toEqual(["under-1800", "1800-2500", "over-2500", "unsure"]);
  });

  it("sends the chosen size with the booking", async () => {
    await openDialog();
    setValue(field("nb-size"), "over-2500");
    await act(async () => {
      dialog().querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(adminCreateBooking).toHaveBeenCalledTimes(1);
    expect(adminCreateBooking.mock.calls[0][0]).toMatchObject({ homeSize: "over-2500" });
  });

  it("sends 'Not sure' when the office doesn't change it (it counts as a large home, so it never overstates room)", async () => {
    await openDialog();
    await act(async () => {
      dialog().querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(adminCreateBooking.mock.calls[0][0]).toMatchObject({ homeSize: "unsure" });
  });
});

describe("the closed-day warning", () => {
  it("asks the public rules route when the dialog opens", async () => {
    await openDialog();
    expect(fetchMock).toHaveBeenCalledWith("/api/public/booking-rules");
  });

  it("warns, in words, when the chosen day is closed to customers, and says it can still be booked", async () => {
    await openDialog();
    setValue(field("nb-date"), "2026-12-25");
    expect(warning().textContent).toContain("Customers can't book this day online");
    expect(warning().textContent).toContain("You can still book it here");
  });

  it("says nothing for an open day, or before a date is chosen", async () => {
    await openDialog();
    expect(warning().textContent).toBe("");
    setValue(field("nb-date"), "2026-12-26");
    expect(warning().textContent).toBe("");
  });

  it("takes the warning away when the date changes to an open day", async () => {
    await openDialog();
    setValue(field("nb-date"), "2026-12-25");
    setValue(field("nb-date"), "2026-12-24");
    expect(warning().textContent).toBe("");
  });

  it("never blocks the booking: a closed day is sent like any other", async () => {
    await openDialog();
    setValue(field("nb-date"), "2026-12-25");
    await act(async () => {
      dialog().querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(adminCreateBooking.mock.calls[0][0]).toMatchObject({ date: "2026-12-25" });
  });

  it("is a status region that is always in the dialog, so the warning is announced when it appears", async () => {
    await openDialog();
    expect(warning()).not.toBeNull();
  });

  it("still works, with no warning, when the closed days can't be fetched", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await openDialog();
    setValue(field("nb-date"), "2026-12-25");
    expect(warning().textContent).toBe("");
    expect(field("nb-size")).not.toBeNull();
  });

  it("ignores an answer that isn't the rules (an error body)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ error: "Booking rules unavailable" }) });
    await openDialog();
    setValue(field("nb-date"), "2026-12-25");
    expect(warning().textContent).toBe("");
  });
});
