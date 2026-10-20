import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Job, StaffMember } from "@/lib/admin-types";

// Pass #2 findings 5 and 11: calendar text meets 4.5:1, and every job card is
// a real, keyboard-focusable link to its booking.

// The modal pulls in server actions; the calendar never opens it here.
vi.mock("../../NewBookingModal", () => ({ default: () => null }));

import CalendarView from "../CalendarView";

const MARCUS: StaffMember = { id: "e-1", name: "Marcus T.", initials: "MT" };

function job(id: string, over: Partial<Job> = {}): Job {
  return {
    id,
    bookingNumber: 1000,
    client: `Client ${id}`,
    service: "Standard Clean",
    address: "1 Main St, Syracuse",
    start: "2026-10-20T12:00:00Z", // 8 AM New York
    end: "2026-10-20T16:00:00Z",
    employeeIds: [],
    status: "confirmed",
    ...over,
  };
}

describe("calendar job cards", () => {
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
    act(() =>
      root.render(
        <CalendarView
          jobs={[job("a", { employeeIds: [MARCUS.id] }), job("b", { status: "cancelled" })]}
          employeeMap={{ [MARCUS.id]: MARCUS }}
        />,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const cards = () => [...container.querySelectorAll<HTMLAnchorElement>(".fc-timegrid-event")];

  it("makes each card a link to /admin/bookings/{id} that Tab can reach", () => {
    expect(cards().map((c) => c.tagName)).toEqual(["A", "A"]);
    expect(cards().map((c) => c.getAttribute("href")).sort()).toEqual([
      "/admin/bookings/a",
      "/admin/bookings/b",
    ]);
    for (const card of cards()) {
      expect(card.getAttribute("tabindex")).not.toBe("-1");
      expect(card.textContent).toMatch(/Client [ab]/); // the link's name is the booking
    }
  });

  it("leaves the cards non-draggable, so the link has no gesture to compete with", () => {
    expect(container.querySelector(".fc-event-draggable")).toBeNull();
  });

  it("sets service and cleaner text in zinc-600 (zinc-500 is about 4.4:1 on blue-50 and red-50)", () => {
    const text = (label: string) =>
      [...container.querySelectorAll(".fc-timegrid-event span")].find((s) => s.textContent === label)!;

    expect(text("Standard Clean").className).toContain("text-zinc-600");
    expect(text("Marcus T.").className).toContain("text-zinc-600");
    expect(container.querySelector(".fc-timegrid-event [class*='text-zinc-500']")).toBeNull();
  });
});

// Contrast of the calendar chrome in app/globals.css. FullCalendar draws it in
// a browser, so the colors are read from the stylesheet.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(__dirname, "..", "..", "..", "globals.css"), "utf8");

function ruleColor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = css.match(new RegExp(`^${escaped}\\s*{([^}]*)}`, "m"));
  expect(body, `rule for ${selector}`).not.toBeNull();
  const color = body![1].match(/(?:^|[\s;])color:\s*([^;]+);/);
  expect(color, `color in ${selector}`).not.toBeNull();
  return color![1].trim();
}

function resolve(value: string): string {
  const token = value.match(/^var\((--[\w-]+)\)$/);
  return token ? css.match(new RegExp(`${token[1]}:\\s*(#[0-9a-f]{6})`, "i"))![1] : value;
}

describe("calendar text contrast (WCAG 1.4.3, 4.5:1)", () => {
  // The grid has no background of its own, so it shows the admin shell's
  // #f5f5f5; the column headers are white and today's column is #f0faf9.
  const grey = "#f5f5f5";
  const white = "#ffffff";
  const todayCol = "#f0faf9";

  it("slot time labels", () => {
    const color = resolve(ruleColor(".admin-calendar .fc-timegrid-slot-label"));
    expect(contrast(color, grey)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color, white)).toBeGreaterThanOrEqual(4.5);
  });

  it("today's column header", () => {
    const color = resolve(
      ruleColor(".admin-calendar .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion"),
    );
    expect(contrast(color, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color, todayCol)).toBeGreaterThanOrEqual(4.5);
  });

  it("other column headers", () => {
    const color = resolve(ruleColor(".admin-calendar .fc-col-header-cell-cushion"));
    expect(contrast(color, white)).toBeGreaterThanOrEqual(4.5);
  });
});
