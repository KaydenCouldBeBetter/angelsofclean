import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Job, JobStatus, StaffMember } from "@/lib/admin-types";
import { DASHBOARD_STATUS } from "../../status-config";

// B30: the All Status and All Employees dropdowns filter the list (in the
// browser, like search) and work together with it.

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import BookingsList from "../BookingsList";

const MARCUS: StaffMember = { id: "e-1", name: "Marcus T.", initials: "MT" };
const DANA: StaffMember = { id: "e-2", name: "Dana R.", initials: "DR" };
const AMY: StaffMember = { id: "e-3", name: "Amy L.", initials: "AL" };
const MAP = { [MARCUS.id]: MARCUS, [DANA.id]: DANA, [AMY.id]: AMY };

function job(n: number, status: JobStatus, employeeIds: string[]): Job {
  return {
    id: `j-${n}`,
    bookingNumber: 1000 + n,
    client: `Client ${n}`,
    service: "Standard Clean",
    address: `${n} Elm Drive`,
    start: "2026-11-02T13:00:00.000Z",
    end: "2026-11-02T17:00:00.000Z",
    employeeIds,
    status,
  };
}

const JOBS = [
  job(1, "pending", []),
  job(2, "confirmed", ["e-1"]),
  job(3, "active", ["e-2"]),
  job(4, "done", ["e-1", "e-2"]),
  job(5, "cancelled", ["e-1"]),
  job(6, "pending", ["e-2"]),
];

let container: HTMLDivElement;
let root: Root;

function mount(jobs: Job[] = JOBS, employeeMap = MAP) {
  act(() => root.render(<BookingsList jobs={jobs} employeeMap={employeeMap} activeTab="all" />));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const select = (name: string) =>
  [...container.querySelectorAll("select")].find(
    (s) => container.querySelector(`label[for="${s.id}"]`)?.textContent === name,
  ) as HTMLSelectElement;
const statusSelect = () => select("Filter by status");
const employeeSelect = () => select("Filter by employee");
const optionLabels = (s: HTMLSelectElement) => [...s.options].map((o) => o.textContent);
const shownClients = () =>
  [...container.querySelectorAll("a[href^='/admin/bookings/']")].map(
    (a) => a.querySelector("p")!.textContent,
  );
const liveRegion = () => container.querySelector("[role='status']")!.textContent;

function choose(el: HTMLSelectElement, value: string) {
  act(() => {
    // React tracks the value, so set it through the native setter and fire "change".
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function typeSearch(text: string) {
  const input = container.querySelector("input")!;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("filter controls", () => {
  it("replaces the 'Coming soon' placeholders with two enabled, labelled dropdowns", () => {
    mount();
    expect(container.textContent).not.toContain("Coming soon");
    for (const s of [statusSelect(), employeeSelect()]) {
      expect(s).toBeTruthy();
      expect(s.disabled).toBe(false);
    }
  });

  it("start on All Status / All Employees and show every booking", () => {
    mount();
    expect(statusSelect().value).toBe("all");
    expect(employeeSelect().value).toBe("all");
    expect(statusSelect().selectedOptions[0].textContent).toBe("All Status");
    expect(employeeSelect().selectedOptions[0].textContent).toBe("All Employees");
    expect(shownClients()).toHaveLength(6);
    expect(liveRegion()).toBe("6 bookings shown");
  });

  it("status options are every status, labelled as the chips are", () => {
    mount();
    expect(optionLabels(statusSelect())).toEqual([
      "All Status",
      DASHBOARD_STATUS.pending.label,
      DASHBOARD_STATUS.confirmed.label,
      DASHBOARD_STATUS.active.label,
      DASHBOARD_STATUS.done.label,
      DASHBOARD_STATUS.cancelled.label,
    ]);
  });

  it("employee options are Unassigned plus every employee, by name", () => {
    mount();
    expect(optionLabels(employeeSelect())).toEqual([
      "All Employees",
      "Unassigned",
      "Amy L.",
      "Dana R.",
      "Marcus T.",
    ]);
  });
});

describe("filtering", () => {
  it.each([
    ["pending", ["Client 1", "Client 6"]],
    ["confirmed", ["Client 2"]],
    ["active", ["Client 3"]],
    ["done", ["Client 4"]],
    ["cancelled", ["Client 5"]],
  ])("status %s shows only those bookings", (status, clients) => {
    mount();
    choose(statusSelect(), status);
    expect(shownClients()).toEqual(clients);
  });

  it("employee filter shows that employee's bookings, including shared ones", () => {
    mount();
    choose(employeeSelect(), "e-1");
    expect(shownClients()).toEqual(["Client 2", "Client 4", "Client 5"]);
    expect(liveRegion()).toBe("3 bookings shown");
  });

  it("Unassigned shows bookings with nobody on them", () => {
    mount();
    choose(employeeSelect(), "unassigned");
    expect(shownClients()).toEqual(["Client 1"]);
    expect(liveRegion()).toBe("1 booking shown");
  });

  it("status, employee and search all apply together", () => {
    mount();
    choose(statusSelect(), "pending");
    choose(employeeSelect(), "e-2");
    expect(shownClients()).toEqual(["Client 6"]);
    typeSearch("client 1");
    expect(shownClients()).toEqual([]);
    typeSearch("client 6");
    expect(shownClients()).toEqual(["Client 6"]);
  });

  it("going back to All Status / All Employees shows everything again", () => {
    mount();
    choose(statusSelect(), "done");
    choose(employeeSelect(), "e-1");
    expect(shownClients()).toEqual(["Client 4"]);
    choose(statusSelect(), "all");
    choose(employeeSelect(), "all");
    expect(shownClients()).toHaveLength(6);
  });

  it("an unknown status value falls back to All Status instead of hiding everything", () => {
    mount();
    choose(statusSelect(), "done");
    expect(shownClients()).toEqual(["Client 4"]);
    // Not an option: the select reports "" and the handler must treat it as "all".
    choose(statusSelect(), "finished");
    expect(shownClients()).toHaveLength(6);
  });

  it("highlights a dropdown that is filtering", () => {
    mount();
    expect(statusSelect().className).not.toContain("border-primary");
    choose(statusSelect(), "done");
    expect(statusSelect().className).toContain("border-primary");
    expect(employeeSelect().className).not.toContain("border-primary");
  });
});

describe("nothing matches", () => {
  it("says the filters hide everything and Clear filters restores the list", () => {
    mount();
    choose(statusSelect(), "active");
    choose(employeeSelect(), "e-1");
    expect(shownClients()).toEqual([]);
    expect(container.textContent).toContain("No bookings match the selected filters.");
    expect(liveRegion()).toBe("0 bookings shown");

    const clear = [...container.querySelectorAll("button")].find((b) => b.textContent === "Clear filters")!;
    act(() => clear.click());

    expect(statusSelect().value).toBe("all");
    expect(employeeSelect().value).toBe("all");
    expect(shownClients()).toHaveLength(6);
  });

  it("Clear filters also empties the search box", () => {
    mount();
    typeSearch("nobody has this name");
    expect(container.textContent).toContain('No bookings matching "nobody has this name".');
    const clear = [...container.querySelectorAll("button")].find((b) => b.textContent === "Clear filters")!;
    act(() => clear.click());
    expect(container.querySelector("input")!.value).toBe("");
    expect(shownClients()).toHaveLength(6);
  });

  it("keeps the tab's own empty message when no filter is on", () => {
    mount([]);
    expect(container.textContent).toContain("No bookings yet.");
    expect(container.textContent).not.toContain("Clear filters");
  });

  it("a filter on an empty tab shows the filter message, not the tab's", () => {
    mount([]);
    choose(statusSelect(), "done");
    expect(container.textContent).toContain("No bookings match the selected filters.");
  });
});
