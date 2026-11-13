import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Job } from "@/lib/admin-types";
import EmployeeCalendar from "../EmployeeCalendar";

const EMPLOYEE = "11111111-1111-4111-8111-111111111111";

// 8:00 AM-12:00 PM on Tue Nov 10, New York (EST, UTC-5).
const JOB: Job = {
  id: "22222222-2222-4222-8222-222222222222",
  bookingNumber: 1042,
  client: "Jo Client",
  service: "Deep Clean",
  address: "1 Main St",
  start: "2026-11-10T13:00:00Z",
  end: "2026-11-10T17:00:00Z",
  employeeIds: [EMPLOYEE],
  status: "confirmed",
};

describe("EmployeeCalendar", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn();

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T17:00:00Z")); // Fri Nov 13, noon in New York
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
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

  async function mount(initialDate = "2026-11-09") {
    await act(async () => {
      root.render(<EmployeeCalendar employeeId={EMPLOYEE} employeeName="Ana V." initialDate={initialDate} />);
    });
    // Let the events fetch settle.
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("is a labelled region", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    await mount();
    expect(container.querySelector('[role="region"]')?.getAttribute("aria-label")).toBe("Ana V.'s calendar");
  });

  it("loads only this employee's jobs for the week on screen", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    await mount("2026-11-09");

    const url = new URL(fetchMock.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/admin/jobs");
    expect(url.searchParams.get("employee")).toBe(EMPLOYEE);
    expect(url.searchParams.get("from")).toBe("2026-11-09"); // a Monday
  });

  it("draws each job as a link to its booking, at its New York time", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [JOB] });
    await mount();

    const link = container.querySelector(`a[href="/admin/bookings/${JOB.id}"]`)!;
    expect(link.textContent).toContain("Jo Client");
    expect(link.textContent).toContain("Deep Clean");
    expect(link.textContent).toContain("Confirmed");
    // Placed in the 8 AM row, not at the viewer's UTC offset.
    const slot = link.closest(".fc-timegrid-col")!.getAttribute("data-date");
    expect(slot).toBe("2026-11-10");
  });

  it("starts the week on Monday", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    await mount();
    const days = [...container.querySelectorAll(".fc-col-header-cell")].map((c) => c.getAttribute("data-date"));
    expect(days[0]).toBe("2026-11-09");
    expect(days).toHaveLength(7);
  });

  it("warns that empty days may not be empty when the jobs can't be loaded, and retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await mount();

    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("couldn't load jobs");

    fetchMock.mockResolvedValue({ ok: true, json: async () => [JOB] });
    const retry = [...alert.querySelectorAll("button")].find((b) => b.textContent === "Try again")!;
    await act(async () => {
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector(`a[href="/admin/bookings/${JOB.id}"]`)).not.toBeNull();
  });

  it("treats a network failure like a failed load, not an empty week", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new TypeError("network down"));
    await mount();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
