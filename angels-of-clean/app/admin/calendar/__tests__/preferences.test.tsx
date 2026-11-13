import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Job } from "@/lib/admin-types";
import { DEFAULT_ADMIN_PREFERENCES, TRAY_COLLAPSED_KEY } from "@/lib/admin-preferences";

vi.mock("../../NewBookingModal", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import CalendarView, { jobsOutsideHours, type CalendarPreferences } from "../CalendarView";

// 8 AM-12 PM New York (EDT, UTC-4) unless overridden.
function job(id: string, date: string, over: Partial<Job> = {}): Job {
  return {
    id,
    bookingNumber: 1000,
    client: `Client ${id}`,
    service: "Standard",
    address: "1 Main St, Syracuse",
    start: `${date}T12:00:00Z`,
    end: `${date}T16:00:00Z`,
    employeeIds: [],
    status: "pending",
    ...over,
  };
}

describe("jobsOutsideHours", () => {
  // Week of Sun Oct 18 to Sun Oct 25 (end exclusive).
  const FROM = "2026-10-18";
  const TO = "2026-10-25";
  const outside = (jobs: Job[], start = 7, end = 17) => jobsOutsideHours(jobs, FROM, TO, start, end).map((j) => j.id);

  it("ignores jobs that sit inside the hours", () => {
    expect(outside([job("a", "2026-10-20")])).toEqual([]); // 8 AM-12 PM
  });

  it("finds a job that starts before the first hour or ends after the last", () => {
    const early = job("early", "2026-10-20", { start: "2026-10-20T10:00:00Z", end: "2026-10-20T14:00:00Z" }); // 6-10 AM
    const late = job("late", "2026-10-20", { start: "2026-10-20T19:00:00Z", end: "2026-10-20T22:00:00Z" }); // 3-6 PM
    expect(outside([early, late])).toEqual(["early", "late"]);
  });

  it("counts a job that touches the edge as inside", () => {
    const exact = job("exact", "2026-10-20", { start: "2026-10-20T11:00:00Z", end: "2026-10-20T21:00:00Z" }); // 7 AM-5 PM
    expect(outside([exact])).toEqual([]);
  });

  it("counts a job that runs past midnight as cut off", () => {
    const night = job("night", "2026-10-20", { start: "2026-10-21T01:00:00Z", end: "2026-10-21T05:00:00Z" }); // 9 PM-1 AM
    expect(outside([night], 0, 24)).toEqual(["night"]);
  });

  it("treats a job ending exactly at midnight as inside a grid that runs to midnight, but not one ending at 1 AM", () => {
    const toMidnight = job("m", "2026-10-20", { start: "2026-10-21T00:00:00Z", end: "2026-10-21T04:00:00Z" }); // 8 PM-midnight
    const pastMidnight = job("p", "2026-10-20", { start: "2026-10-21T00:00:00Z", end: "2026-10-21T05:00:00Z" }); // 8 PM-1 AM
    expect(outside([toMidnight], 0, 24)).toEqual([]);
    expect(outside([pastMidnight], 0, 24)).toEqual(["p"]);
  });

  it("follows New York's clock, not UTC: 10 PM EDT is already the next day in UTC", () => {
    const evening = job("evening", "2026-10-20", { start: "2026-10-21T02:00:00Z", end: "2026-10-21T03:00:00Z" });
    expect(jobsOutsideHours([evening], "2026-10-20", "2026-10-21", 7, 17).map((j) => j.id)).toEqual(["evening"]);
    expect(jobsOutsideHours([evening], "2026-10-21", "2026-10-22", 7, 17)).toEqual([]);
  });

  it("looks only at the visible dates (end exclusive)", () => {
    const early = (id: string, date: string) =>
      job(id, date, { start: `${date}T10:00:00Z`, end: `${date}T14:00:00Z` });
    expect(outside([early("before", "2026-10-17"), early("first", "2026-10-18"), early("after", "2026-10-25")])).toEqual([
      "first",
    ]);
  });

  it("widening the hours stops flagging the job", () => {
    const late = job("late", "2026-10-20", { start: "2026-10-20T19:00:00Z", end: "2026-10-20T22:00:00Z" });
    expect(outside([late], 7, 17)).toEqual(["late"]);
    expect(outside([late], 7, 18)).toEqual([]);
  });
});

describe("CalendarView with preferences", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // Only Date is faked, so FullCalendar's timers and act keep working.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T16:00:00Z")); // Mon Oct 19, noon in New York
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
    vi.useRealTimers();
  });

  const prefs = (over: Partial<CalendarPreferences> = {}): CalendarPreferences => ({
    ...DEFAULT_ADMIN_PREFERENCES,
    ...over,
  });
  const mount = (over: Partial<CalendarPreferences> = {}, jobs: Job[] = [job("a", "2026-10-20")]) =>
    act(() => root.render(<CalendarView jobs={jobs} employeeMap={{}} preferences={prefs(over)} />));
  const click = (el: Element) =>
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  const toggle = () =>
    container.querySelector<HTMLButtonElement>("section[aria-labelledby='unassigned-heading'] button")!;
  const slotLabels = () => [...container.querySelectorAll(".fc-timegrid-slot-label")].map((l) => l.textContent!.trim());
  const headerDays = () =>
    [...container.querySelectorAll(".fc-col-header-cell, .fc-day-header, .fc-scrollgrid-section-header th")]
      .map((h) => h.textContent!.trim())
      .filter(Boolean);
  const notice = () => container.querySelector('[role="status"]');

  it("looks as it did before Settings existed when given no preferences", () => {
    act(() => root.render(<CalendarView jobs={[job("a", "2026-10-20")]} employeeMap={{}} />));
    expect(container.querySelector(".fc-timeGridWeek-view")).not.toBeNull();
    expect(slotLabels()[0]).toBe("7:00 AM");
    expect(slotLabels().at(-1)).toBe("4:00 PM");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });

  it("opens in the month view when asked", () => {
    mount({ calendarView: "month" });
    expect(container.querySelector(".fc-dayGridMonth-view")).not.toBeNull();
    expect(container.querySelector(".fc-timeGridWeek-view")).toBeNull();
  });

  it("still opens in the week view, tray included, for a week preference", () => {
    mount({ calendarView: "week" });
    expect(container.querySelector(".fc-timeGridWeek-view")).not.toBeNull();
    expect(container.querySelector("#unassigned-heading")).not.toBeNull();
  });

  it("starts the week on Monday, or on Sunday", () => {
    mount({ weekStartsOn: "monday" });
    expect(headerDays()[0]).toMatch(/^Mon/);
    expect(headerDays().at(-1)).toMatch(/^Sun/);

    act(() => root.unmount());
    root = createRoot(container);
    mount({ weekStartsOn: "sunday" });
    expect(headerDays()[0]).toMatch(/^Sun/);
  });

  it("starts the Monday month grid on a Monday too", () => {
    mount({ calendarView: "month", weekStartsOn: "monday" });
    expect(headerDays()[0]).toMatch(/^Mon/);
  });

  it("shows the chosen hours", () => {
    mount({ calendarStartHour: 6, calendarEndHour: 20 });
    expect(slotLabels()[0]).toBe("6:00 AM");
    expect(slotLabels().at(-1)).toBe("7:00 PM"); // the last slot starts an hour before the end
  });

  describe("the Unassigned list", () => {
    it("starts hidden when that is the default, with the count still showing", () => {
      mount({ unassignedListCollapsed: true });
      expect(toggle().getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector<HTMLElement>("#unassigned-list")!.hidden).toBe(true);
      expect(container.querySelector("#unassigned-heading")!.textContent).toContain("1");
    });

    it("lets this browser's own choice beat the default, for shown and for hidden", () => {
      window.localStorage.setItem(TRAY_COLLAPSED_KEY, "0");
      mount({ unassignedListCollapsed: true });
      expect(toggle().getAttribute("aria-expanded")).toBe("true");

      act(() => root.unmount());
      root = createRoot(container);
      window.localStorage.setItem(TRAY_COLLAPSED_KEY, "1");
      mount({ unassignedListCollapsed: false });
      expect(toggle().getAttribute("aria-expanded")).toBe("false");
    });

    it("remembers 'shown' when the default is hidden, and forgets it once it matches the default", () => {
      mount({ unassignedListCollapsed: true });
      click(toggle());
      expect(window.localStorage.getItem(TRAY_COLLAPSED_KEY)).toBe("0");
      click(toggle());
      expect(window.localStorage.getItem(TRAY_COLLAPSED_KEY)).toBe("1");
    });

    it("keeps the old behaviour when the default is shown: hidden is stored, shown is not", () => {
      mount({ unassignedListCollapsed: false });
      click(toggle());
      expect(window.localStorage.getItem(TRAY_COLLAPSED_KEY)).toBe("1");
      click(toggle());
      expect(window.localStorage.getItem(TRAY_COLLAPSED_KEY)).toBeNull();
    });
  });

  describe("jobs the chosen hours would hide", () => {
    const evening = job("evening", "2026-10-21", { start: "2026-10-21T22:00:00Z", end: "2026-10-22T00:00:00Z" }); // 6-8 PM

    it("says so, and where to change it, instead of letting a job vanish", () => {
      mount({}, [job("a", "2026-10-20"), evening]);
      const text = notice()!.textContent!;
      expect(text).toContain("1 job this week runs outside the hours shown");
      expect(text).toContain("7:00 AM to 5:00 PM");
      expect(notice()!.querySelector("a")!.getAttribute("href")).toBe("/admin/settings");
    });

    it("says nothing when every job fits", () => {
      mount({}, [job("a", "2026-10-20")]);
      expect(notice()).toBeNull();
    });

    it("goes away when the hours cover the job", () => {
      mount({ calendarStartHour: 7, calendarEndHour: 21 }, [job("a", "2026-10-20"), evening]);
      expect(notice()).toBeNull();
    });

    it("is not shown in the month view, which has no hours to cut off", () => {
      mount({ calendarView: "month" }, [evening]);
      expect(notice()).toBeNull();
    });

    it("pluralises", () => {
      mount({}, [evening, job("evening-2", "2026-10-22", { start: "2026-10-22T22:00:00Z", end: "2026-10-23T00:00:00Z" })]);
      expect(notice()!.textContent).toContain("2 jobs this week run outside the hours shown");
    });
  });
});
