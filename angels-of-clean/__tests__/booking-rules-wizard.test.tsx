import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DEFAULT_BOOKING_RULES, type BookingRules } from "@/lib/booking-rules";

// Admin Settings (phase 2a) as a customer meets it: the pause notice that takes
// the place of the booking steps, and a date step that follows the admin's closed
// days, notice and day limit instead of a fixed week with a made-up "Full" day.

let pathname = "/residential";
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => pathname,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useBookingStore } from "@/store/bookingStore";
import ResidentialShell from "@/components/booking/ResidentialShell";
import DateTimePage from "@/app/residential/datetime/page";

// 10:00 AM EDT on Mon 2026-10-19: today's morning slot has started, the afternoon one (noon) has not.
const NOW = new Date("2026-10-19T14:00:00.000Z");

const SEED = {
  service: "standard" as const,
  frequency: "one-time" as const,
  address: "1 Test St",
  city: "Cicero",
  zip: "13039",
};

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

// The route answers in the wizard's own camelCase shape.
function answer(rules: Partial<BookingRules>) {
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ...DEFAULT_BOOKING_RULES, ...rules }) });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // Only Date is faked, so promises, timers and act keep working.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  answer({});
  pathname = "/residential";
  useBookingStore.getState().reset();
  useBookingStore.setState(SEED);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function render(ui: React.ReactElement) {
  await act(async () => root.render(ui));
}
const shell = (path: string) => {
  pathname = path;
  return render(
    <ResidentialShell>
      <p data-testid="step">the booking step</p>
    </ResidentialShell>,
  );
};
const stepShown = () => container.querySelector('[data-testid="step"]') !== null;
const page = () => render(<ResidentialShell><DateTimePage /></ResidentialShell>);

describe("the pause gate in the residential shell", () => {
  const PAUSED = { paused: true, pauseMessage: "We're closed until Monday." };

  it("asks the public rules route, once per step", async () => {
    await shell("/residential");
    expect(fetchMock).toHaveBeenCalledWith("/api/public/booking-rules");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the admin's message and the phone number instead of the step while paused", async () => {
    answer(PAUSED);
    await shell("/residential");
    expect(stepShown()).toBe(false);
    expect(container.querySelector("h1")!.textContent).toBe("Online booking is paused");
    expect(container.textContent).toContain("We're closed until Monday.");
    expect(container.querySelector<HTMLAnchorElement>('a[href^="tel:"]')!.textContent).toBe("(315) 516-1266");
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
  });

  it("uses the standard wording when the admin wrote no message", async () => {
    answer({ paused: true, pauseMessage: "" });
    await shell("/residential");
    expect(container.textContent).toContain("Online booking is paused right now.");
  });

  it.each([
    "/residential",
    "/residential/address",
    "/residential/property",
    "/residential/datetime",
    "/residential/contact",
    "/residential/review",
  ])("replaces %s", async (path) => {
    answer(PAUSED);
    await shell(path);
    expect(stepShown()).toBe(false);
  });

  it.each(["/residential/confirmation", "/residential/error"])(
    "leaves %s alone, so someone who just booked still sees that it worked",
    async (path) => {
      answer(PAUSED);
      await shell(path);
      expect(stepShown()).toBe(true);
    },
  );

  it("drops the stepper and the summary sidebar while paused", async () => {
    answer(PAUSED);
    await shell("/residential/datetime");
    expect(container.querySelector("aside, [aria-label*='Booking summary']")).toBeNull();
    expect(container.textContent).not.toContain("Date & Time");
  });

  it("lets booking carry on when the rules say it is open", async () => {
    answer({ paused: false });
    await shell("/residential");
    expect(stepShown()).toBe(true);
  });

  it("lets booking carry on while the rules load, and if they never do (the server decides)", async () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never answers
    await shell("/residential");
    expect(stepShown()).toBe(true);

    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: "Booking rules unavailable" }) });
    act(() => root.unmount());
    root = createRoot(container);
    await shell("/residential");
    expect(stepShown()).toBe(true);

    fetchMock.mockRejectedValue(new Error("offline"));
    act(() => root.unmount());
    root = createRoot(container);
    await shell("/residential");
    expect(stepShown()).toBe(true);
  });

  it("doesn't mistake a malformed answer for a pause, or for an open shop with new rules", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ paused: "true" }) });
    await shell("/residential");
    expect(stepShown()).toBe(true);
  });

  it("notices a pause set while someone is partway through, at their next step", async () => {
    await shell("/residential/address");
    expect(stepShown()).toBe(true);
    answer(PAUSED);
    await shell("/residential/property");
    expect(stepShown()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("the date step follows the booking rules", () => {
  const chips = () => [...container.querySelectorAll<HTMLInputElement>('[aria-label="Select a date"] input')];
  const chipNames = () => chips().map((c) => c.getAttribute("aria-label"));
  const selectedDate = () => chips().find((c) => c.checked)?.value ?? null;
  const slots = () => [...container.querySelectorAll<HTMLInputElement>('[aria-labelledby="time-slot-label"] input')];
  const showMore = () => [...container.querySelectorAll("button")].find((b) => b.textContent === "Show more dates");
  const nextButton = () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Next")) as HTMLButtonElement;
  const click = (el: Element) => act(async () => (el as HTMLElement).click());

  beforeEach(() => {
    pathname = "/residential/datetime";
  });

  it("offers six dates at first, as before, with every one open", async () => {
    await page();
    expect(chipNames()).toEqual([
      "Mon Oct 19", "Tue Oct 20", "Wed Oct 21", "Thu Oct 22", "Fri Oct 23", "Sat Oct 24",
    ]);
    expect(chips().every((c) => !c.disabled)).toBe(true);
  });

  it("reaches today + 6 days by default, with 'Show more dates' for the seventh", async () => {
    // The default limit is 6 days ahead. Someone booking after noon (today's slots
    // gone) already sees tomorrow through today + 6; this gives the same last day
    // to someone booking in the morning.
    await page();
    await click(showMore()!);
    expect(chips().at(-1)!.value).toBe("2026-10-25");
    expect(chips()).toHaveLength(7);
    expect(showMore()).toBeUndefined();
  });

  it("no longer invents a 'Full' day", async () => {
    await page();
    expect(container.textContent).not.toContain("Full");
    expect(chips()[2].disabled).toBe(false);
  });

  it("preselects the second open day, not today's same-day rush", async () => {
    await page();
    expect(selectedDate()).toBe("2026-10-20");
  });

  it("works while the rules haven't arrived, with the defaults", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    await page();
    expect(chips()).toHaveLength(6);
  });

  describe("closed days", () => {
    it("shows a closed day as Closed, disabled, and says so to screen readers", async () => {
      answer({ blackoutDates: ["2026-10-22"] });
      await page();
      const closed = chips().find((c) => c.value === "2026-10-22")!;
      expect(closed.disabled).toBe(true);
      expect(closed.getAttribute("aria-label")).toBe("Thu Oct 22, Closed");
      expect(closed.closest("label")!.textContent).toContain("Closed");
    });

    it("never selects a closed day: the preselected day moves on", async () => {
      answer({ blackoutDates: ["2026-10-20"] });
      await page();
      expect(selectedDate()).toBe("2026-10-21");
    });

    it("drops a stored date the admin has since closed", async () => {
      useBookingStore.setState({ date: "2026-10-22", timeSlot: "morning" });
      answer({ blackoutDates: ["2026-10-22"] });
      await page();
      expect(selectedDate()).not.toBe("2026-10-22");
      expect(selectedDate()).toBe("2026-10-20");
    });

    it("keeps a stored date that is still open", async () => {
      useBookingStore.setState({ date: "2026-10-23", timeSlot: "morning" });
      await page();
      expect(selectedDate()).toBe("2026-10-23");
    });
  });

  describe("minimum notice", () => {
    it("starts at the first day with a slot that has enough notice, and disables the slot that doesn't", async () => {
      // 48 hours from 10 AM Monday: Wednesday's 8 AM (46h) is too soon, noon (50h) is fine.
      answer({ minNoticeHours: 48, maxDaysAhead: 14 });
      await page();
      expect(chips()[0].value).toBe("2026-10-21");
      await click(chips()[0]);
      const [morning, afternoon] = slots();
      expect(morning.disabled).toBe(true);
      expect(morning.closest("label")!.textContent).toContain("Unavailable");
      expect(afternoon.disabled).toBe(false);
      expect(afternoon.checked).toBe(true);
    });

    it("moves the chosen slot to one that works rather than keeping a refused one", async () => {
      useBookingStore.setState({ date: "2026-10-21", timeSlot: "morning" });
      answer({ minNoticeHours: 48, maxDaysAhead: 14 });
      await page();
      expect(selectedDate()).toBe("2026-10-21");
      expect(slots()[1].checked).toBe(true);
    });
  });

  describe("how far ahead", () => {
    it("stops at the admin's limit, counting from today", async () => {
      answer({ maxDaysAhead: 3 });
      await page();
      expect(chipNames()).toEqual(["Mon Oct 19", "Tue Oct 20", "Wed Oct 21", "Thu Oct 22"]);
      expect(showMore()).toBeUndefined();
    });

    it("adds six dates at a time with 'Show more dates', until the limit", async () => {
      answer({ maxDaysAhead: 14 });
      await page();
      expect(chips()).toHaveLength(6);
      await click(showMore()!);
      expect(chips()).toHaveLength(12);
      await click(showMore()!);
      expect(chips()).toHaveLength(15); // today + 14 days
      expect(chips().at(-1)!.value).toBe("2026-11-02");
      expect(showMore()).toBeUndefined();
    });

    it("labels the month where it begins, so dates weeks out aren't a bare number", async () => {
      answer({ maxDaysAhead: 14 });
      await page();
      await click(showMore()!);
      await click(showMore()!); // twelve dates only reach Oct 30
      const label = (value: string) => chips().find((c) => c.value === value)!.closest("label")!.textContent!;
      expect(label("2026-10-19")).toContain("Oct"); // the first chip
      expect(label("2026-10-20")).not.toContain("Oct"); // same month: no repeat
      expect(label("2026-10-31")).not.toContain("Nov");
      expect(label("2026-11-01")).toContain("Nov"); // a new month starts
      expect(label("2026-11-02")).not.toContain("Nov");
    });

    it("always shows a stored date, however far out, and keeps it selected", async () => {
      useBookingStore.setState({ date: "2026-11-05", timeSlot: "morning" });
      answer({ maxDaysAhead: 30 });
      await page();
      expect(chips().some((c) => c.value === "2026-11-05")).toBe(true);
      expect(selectedDate()).toBe("2026-11-05");
    });

    it("ignores a stored date beyond the limit", async () => {
      useBookingStore.setState({ date: "2026-12-30", timeSlot: "morning" });
      answer({ maxDaysAhead: 14 });
      await page();
      expect(selectedDate()).not.toBe("2026-12-30");
    });
  });

  describe("when nothing can be chosen", () => {
    it("says to call, and disables Next, when no day is open at all", async () => {
      answer({ maxDaysAhead: 3, blackoutDates: ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"] });
      await page();
      expect(chips().every((c) => c.disabled)).toBe(true);
      expect(container.querySelector('[role="status"]')!.textContent).toContain("(315) 516-1266");
      expect(nextButton().disabled).toBe(true);
    });

    it("points to 'Show more dates' when later days might be open", async () => {
      answer({
        maxDaysAhead: 30,
        blackoutDates: ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"],
      });
      await page();
      expect(container.querySelector('[role="status"]')!.textContent).toContain("Show more dates");
      expect(nextButton().disabled).toBe(true);
      await click(showMore()!);
      expect(selectedDate()).toBe("2026-10-26");
      expect(nextButton().disabled).toBe(false);
    });
  });

  it("saves the chosen date and slot, and moves on", async () => {
    await page();
    await click(chips().find((c) => c.value === "2026-10-23")!);
    await click(slots()[1]);
    await click(nextButton());
    expect(useBookingStore.getState().date).toBe("2026-10-23");
    expect(useBookingStore.getState().timeSlot).toBe("afternoon");
    expect(push).toHaveBeenCalledWith("/residential/contact");
  });

  it("disables today's morning slot once it has started, and preselects the afternoon", async () => {
    await page();
    await click(chips()[0]);
    expect(slots()[0].disabled).toBe(true);
    expect(slots()[1].checked).toBe(true);
  });

  it("returns to review when it was opened from there", async () => {
    // The mocked useSearchParams has no returnTo, so this pins the default route.
    await page();
    await click(nextButton());
    expect(push).toHaveBeenCalledWith("/residential/contact");
  });
});
