import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Employee, Job, JobStatus } from "@/lib/admin-types";
import { STATUS_CONFIG } from "../../status-config";

// The modal pulls in server actions; the calendar never opens it here.
vi.mock("../../NewBookingModal", () => ({ default: () => null }));

import CalendarView, { UnassignedTray, isUnassigned, unassignedByDay } from "../CalendarView";

const MARCUS: Employee = { id: "e-1", name: "Marcus T.", initials: "MT", phone: "", hiredDate: "Mar 2024" };

// 8 AM–12 PM New York (EDT, UTC-4) on the given date.
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

describe("isUnassigned", () => {
  const cases: [JobStatus, string[], boolean][] = [
    ["pending", [], true],
    ["confirmed", [], true],
    ["active", [], true],
    ["done", [], false],
    ["cancelled", [], false],
    ["pending", ["e-1"], false],
    ["confirmed", ["e-1", "e-2"], false],
  ];
  it.each(cases)("%s with crew %j → %s", (status, employeeIds, expected) => {
    expect(isUnassigned(job("a", "2026-10-20", { status, employeeIds }))).toBe(expected);
  });
});

describe("unassignedByDay", () => {
  it("groups by New York date in start order and leaves out assigned, done and cancelled jobs", () => {
    const byDay = unassignedByDay([
      job("late", "2026-10-20", { start: "2026-10-20T18:00:00Z", end: "2026-10-20T20:00:00Z" }),
      job("early", "2026-10-20"),
      job("crewed", "2026-10-20", { employeeIds: ["e-1"] }),
      job("gone", "2026-10-21", { status: "cancelled" }),
      job("other-day", "2026-10-22"),
    ]);
    expect([...byDay.keys()]).toEqual(["2026-10-20", "2026-10-22"]);
    expect(byDay.get("2026-10-20")!.map((j) => j.id)).toEqual(["early", "late"]);
  });

  it("files a job under its New York day, not its UTC day", () => {
    // 10 PM EDT on Oct 20 is already Oct 21 in UTC.
    const byDay = unassignedByDay([
      job("night", "2026-10-21", { start: "2026-10-21T02:00:00Z", end: "2026-10-21T03:00:00Z" }),
    ]);
    expect([...byDay.keys()]).toEqual(["2026-10-20"]);
  });
});

function trayDoc(jobs: Job[], from = "2026-10-18", to = "2026-10-25") {
  const html = renderToStaticMarkup(<UnassignedTray byDay={unassignedByDay(jobs)} from={from} to={to} />);
  return new DOMParser().parseFromString(html, "text/html");
}

describe("UnassignedTray", () => {
  it("lists the week's unassigned jobs under a labelled heading with a count", () => {
    const doc = trayDoc([job("a", "2026-10-20"), job("b", "2026-10-22"), job("far", "2026-11-10")]);
    const section = doc.querySelector("section")!;
    const heading = doc.getElementById(section.getAttribute("aria-labelledby")!)!;
    expect(heading.textContent).toContain("Unassigned");
    expect(heading.textContent).toContain("2");
    expect(doc.querySelectorAll("li")).toHaveLength(2);
    expect(doc.body.textContent).not.toContain("Client far");
  });

  it("says so when every job this week has a crew", () => {
    const doc = trayDoc([job("a", "2026-10-20", { employeeIds: [MARCUS.id] })]);
    expect(doc.querySelectorAll("li")).toHaveLength(0);
    expect(doc.body.textContent).toContain("Every job this week has a crew.");
  });

  it("uses each job's status colors and label", () => {
    const doc = trayDoc([
      job("p", "2026-10-20", { status: "pending" }),
      job("c", "2026-10-21", { status: "confirmed" }),
      job("a", "2026-10-22", { status: "active" }),
    ]);
    for (const status of ["pending", "confirmed", "active"] as const) {
      const cfg = STATUS_CONFIG[status];
      const link = [...doc.querySelectorAll("a")].find((a) => a.textContent!.includes(cfg.label))!;
      expect(link.className).toContain(cfg.cardBg);
      expect(link.className).toContain(cfg.borderColor);
      expect(link.querySelector(`.${cfg.chipBg}`)!.textContent).toBe(cfg.label);
    }
  });

  it("is keyboard-operable: each job is a plain link to its booking, in the tab order", () => {
    const doc = trayDoc([job("a", "2026-10-20"), job("b", "2026-10-21")]);
    const links = [...doc.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/admin/bookings/a", "/admin/bookings/b"]);
    for (const a of links) {
      expect(a.getAttribute("tabindex")).not.toBe("-1");
      expect(a.textContent).toMatch(/Client/); // has a readable name
    }
    // Nothing in the tray needs a mouse: no click-only elements.
    expect(doc.querySelectorAll("[onclick], [role='button']:not(button)")).toHaveLength(0);
  });
});

describe("CalendarView", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // Only Date is faked, so FullCalendar's timers and act keep working.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T16:00:00Z")); // Mon Oct 19, noon in New York
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const jobs = [
    job("this-week", "2026-10-20"),
    job("crewed", "2026-10-20", { employeeIds: [MARCUS.id] }),
    job("next-week", "2026-10-28"),
    job("next-week-2", "2026-10-28", { start: "2026-10-28T18:00:00Z", end: "2026-10-28T20:00:00Z" }),
  ];

  function mount() {
    act(() => root.render(<CalendarView jobs={jobs} employeeMap={{ [MARCUS.id]: MARCUS }} />));
  }

  function click(el: Element) {
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  it("pins the Unassigned tray above the weekly grid with only this week's jobs", () => {
    mount();
    const tray = container.querySelector("section[aria-labelledby='unassigned-heading']")!;
    expect(tray).not.toBeNull();
    expect(tray.textContent).toContain("Client this-week");
    expect(tray.textContent).not.toContain("Client crewed");
    expect(tray.textContent).not.toContain("Client next-week");
    // Above the calendar, not inside it, so the grid scrolls underneath.
    const grid = container.querySelector(".fc")!;
    expect(tray.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(grid.contains(tray)).toBe(false);
  });

  it("shows a count on month days with unassigned jobs, as a keyboard link to that day's week", () => {
    mount();
    click(container.querySelector(".fc-dayGridMonth-button")!);

    expect(container.querySelector("section[aria-labelledby='unassigned-heading']")).toBeNull();

    const oct20 = container.querySelector<HTMLElement>(".fc-daygrid-day[data-date='2026-10-20']")!;
    const oct28 = container.querySelector<HTMLElement>(".fc-daygrid-day[data-date='2026-10-28']")!;
    const oct21 = container.querySelector<HTMLElement>(".fc-daygrid-day[data-date='2026-10-21']")!;
    expect(oct20.textContent).toContain("1 unassigned");
    expect(oct28.textContent).toContain("2 unassigned");
    expect(oct21.textContent).not.toContain("unassigned");

    // The day number is a focusable link whose name includes the count.
    const link = oct28.querySelector<HTMLElement>("a.fc-daygrid-day-number")!;
    expect(link.hasAttribute("data-navlink")).toBe(true);
    expect(link.tabIndex).toBe(0);
    expect(link.textContent).toContain("2 unassigned jobs");

    // Enter on the link opens that day's week with the tray showing its jobs.
    act(() => {
      link.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const tray = container.querySelector("section[aria-labelledby='unassigned-heading']")!;
    expect(tray.textContent).toContain("Client next-week");
    expect(tray.textContent).not.toContain("Client this-week");
  });
});
