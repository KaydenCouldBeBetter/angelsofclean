import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AdminPlan, AdminQuoteRef, AdminVisitRef } from "@/lib/admin-customer-types";
import type { InvoiceDetail } from "@/lib/customer-types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

type Result = { success: true } | { success: false; error: string };
const createServicePlan = vi.fn<(...a: unknown[]) => Promise<Result>>();
const setServicePlanStatus = vi.fn<(...a: unknown[]) => Promise<Result>>();
const createInvoice = vi.fn<(...a: unknown[]) => Promise<Result>>();
const markInvoicePaid = vi.fn<(...a: unknown[]) => Promise<Result>>();
const voidInvoice = vi.fn<(...a: unknown[]) => Promise<Result>>();
const reopenInvoice = vi.fn<(...a: unknown[]) => Promise<Result>>();
const linkBookingToAccount = vi.fn<(...a: unknown[]) => Promise<Result>>();
vi.mock("../actions", () => ({
  createServicePlan: (...a: unknown[]) => createServicePlan(...a),
  setServicePlanStatus: (...a: unknown[]) => setServicePlanStatus(...a),
  createInvoice: (...a: unknown[]) => createInvoice(...a),
  markInvoicePaid: (...a: unknown[]) => markInvoicePaid(...a),
  voidInvoice: (...a: unknown[]) => voidInvoice(...a),
  reopenInvoice: (...a: unknown[]) => reopenInvoice(...a),
  linkBookingToAccount: (...a: unknown[]) => linkBookingToAccount(...a),
}));

import PlanSection from "../[id]/PlanSection";
import InvoiceSection from "../[id]/InvoiceSection";
import LinkBookingForm from "../[id]/LinkBookingForm";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-11-10";
const OK: Result = { success: true };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  for (const action of [createServicePlan, setServicePlanStatus, createInvoice, markInvoicePaid, voidInvoice, reopenInvoice, linkBookingToAccount]) {
    action.mockResolvedValue(OK);
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (ui: React.ReactElement) => act(() => root.render(ui));
const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.replace(/\s+/g, " ").includes(text)) as HTMLButtonElement | undefined;
async function click(el: Element | undefined) {
  if (!el) throw new Error("element not found");
  await act(async () => {
    (el as HTMLElement).click();
  });
}
function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const field = <T extends HTMLElement = HTMLInputElement>(id: string) => container.querySelector<T>(`#${id}`)!;
async function submit(form?: Element | null) {
  await act(async () => {
    (form ?? container.querySelector("form")!).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

const PLAN: AdminPlan = {
  id: "p-1",
  serviceType: "standard",
  serviceLabel: "Standard Clean",
  frequency: "bi-weekly",
  frequencyLabel: "Bi-weekly",
  address: "1 Main St",
  city: "Syracuse",
  zip: "13202",
  status: "active",
  statusLabel: "Active",
  notes: "Gate on the left",
};

describe("PlanSection", () => {
  const plans = (list: AdminPlan[] = []) => render(<PlanSection accountId={ACCOUNT_ID} accountType="residential" plans={list} />);

  it("says there is no plan, and every field in the form has a label", async () => {
    plans();
    expect(container.textContent).toContain("No service plan yet.");
    await click(button("Add plan"));
    for (const id of ["plan-service", "plan-frequency", "plan-address", "plan-city", "plan-zip", "plan-notes"]) {
      expect(container.querySelector(`label[for="${id}"]`), id).not.toBeNull();
    }
  });

  it("never offers one-time", async () => {
    plans();
    await click(button("Add plan"));
    const options = [...field<HTMLSelectElement>("plan-frequency").options].map((o) => o.value);
    expect(options).not.toContain("one-time");
    expect(options).toEqual(["weekly", "bi-weekly", "monthly", "2-3x", "daily"]);
  });

  it("defaults a business account to the commercial service", async () => {
    render(<PlanSection accountId={ACCOUNT_ID} accountType="commercial" plans={[]} />);
    await click(button("Add plan"));
    expect(field<HTMLSelectElement>("plan-service").value).toBe("commercial");
  });

  it("creates a plan with what was typed, then closes the form and refreshes", async () => {
    plans();
    await click(button("Add plan"));
    setValue(field("plan-frequency"), "weekly");
    setValue(field("plan-address"), "1 Main St");
    setValue(field("plan-city"), "Syracuse");
    setValue(field("plan-zip"), "13202");
    setValue(field("plan-notes"), "Gate on the left");
    await submit();
    expect(createServicePlan).toHaveBeenCalledWith(ACCOUNT_ID, {
      serviceType: "standard",
      frequency: "weekly",
      address: "1 Main St",
      city: "Syracuse",
      zip: "13202",
      notes: "Gate on the left",
    });
    expect(refresh).toHaveBeenCalled();
    expect(container.querySelector("form")).toBeNull();
  });

  it("keeps the form open and announces the server's error", async () => {
    createServicePlan.mockResolvedValue({ success: false, error: "Enter a 5-digit ZIP code." });
    plans();
    await click(button("Add plan"));
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("5-digit ZIP");
    expect(container.querySelector("form")).not.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("pauses and resumes an active plan", async () => {
    plans([PLAN]);
    await click(button("Pause"));
    expect(setServicePlanStatus).toHaveBeenCalledWith("p-1", "paused");

    act(() => root.unmount());
    root = createRoot(container);
    plans([{ ...PLAN, status: "paused", statusLabel: "Paused" }]);
    await click(button("Resume"));
    expect(setServicePlanStatus).toHaveBeenLastCalledWith("p-1", "active");
  });

  it("asks before ending a plan, and can back out", async () => {
    plans([PLAN]);
    await click(button("End plan"));
    expect(setServicePlanStatus).not.toHaveBeenCalled();
    expect(button("Yes, end this plan")).toBeDefined();
    await click(button("Keep it"));
    expect(button("Yes, end this plan")).toBeUndefined();

    await click(button("End plan"));
    await click(button("Yes, end this plan"));
    expect(setServicePlanStatus).toHaveBeenCalledWith("p-1", "ended");
  });

  it("offers no actions on an ended plan", () => {
    plans([{ ...PLAN, status: "ended", statusLabel: "Ended" }]);
    expect(button("Pause")).toBeUndefined();
    expect(button("End plan")).toBeUndefined();
    expect(container.textContent).toContain("Ended");
  });
});

const INVOICE: InvoiceDetail = {
  id: "i-1",
  number: "INV-1007",
  description: "Standard clean, Nov 2",
  amountCents: 12550,
  amountLabel: "$125.50",
  issuedOn: "2026-11-02",
  issuedLabel: "November 2, 2026",
  dueOn: "2026-11-30",
  dueLabel: "November 30, 2026",
  status: "open",
  paidLabel: null,
  paymentNote: null,
  visit: null,
  quoteRef: null,
};
const VISITS: AdminVisitRef[] = [{ id: "b1", ref: "AOC-1043", label: "Standard Clean on November 2, 2026", status: "confirmed" }];
const QUOTES: AdminQuoteRef[] = [{ id: "q1", ref: "COM-1007", businessName: "Bob's Bakery" }];

describe("InvoiceSection", () => {
  const invoices = (list: InvoiceDetail[] = [], visits = VISITS, quotes = QUOTES) =>
    render(<InvoiceSection accountId={ACCOUNT_ID} invoices={list} visits={visits} quotes={quotes} today={TODAY} defaultDueOn="2026-12-10" />);

  it("summarises what is owed and says nothing is charged online", () => {
    invoices([INVOICE, { ...INVOICE, id: "i-2", number: "INV-1008", amountCents: 7500, amountLabel: "$75.00" }]);
    expect(container.textContent).toContain("$200.50 owed on 2 open invoices");
    expect(container.textContent).toContain("Nothing is charged online");
  });

  it("says nothing is owed when everything is settled", () => {
    invoices([{ ...INVOICE, status: "paid", paidLabel: "November 5, 2026" }]);
    expect(container.textContent).toContain("Nothing owed.");
  });

  it("shows overdue in words and with an icon", () => {
    invoices([{ ...INVOICE, dueOn: "2026-11-01", dueLabel: "November 1, 2026" }]);
    const chip = [...container.querySelectorAll("span")].find((s) => s.textContent === "Overdue")!;
    expect(chip).toBeDefined();
    expect(chip.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("creates an invoice with the typed amount as text (the server parses it), defaults, and a visit", async () => {
    invoices();
    await click(button("Add invoice"));
    expect(field("invoice-issued").getAttribute("value") ?? (field("invoice-issued") as HTMLInputElement).value).toBe(TODAY);
    expect((field("invoice-due") as HTMLInputElement).value).toBe("2026-12-10");
    setValue(field("invoice-amount"), "125.50");
    setValue(field("invoice-description"), "Standard clean");
    setValue(field<HTMLSelectElement>("invoice-for"), "booking:b1");
    await submit();
    expect(createInvoice).toHaveBeenCalledWith(ACCOUNT_ID, {
      amount: "125.50",
      description: "Standard clean",
      issuedOn: TODAY,
      dueOn: "2026-12-10",
      bookingId: "b1",
      quoteId: null,
    });
    expect(refresh).toHaveBeenCalled();
    expect(container.querySelector("form")).toBeNull();
  });

  it("can bill a quote instead, and offers only this account's visits and quotes", async () => {
    invoices();
    await click(button("Add invoice"));
    const select = field<HTMLSelectElement>("invoice-for");
    expect([...select.options].map((o) => o.value)).toEqual(["", "booking:b1", "quote:q1"]);
    setValue(field("invoice-amount"), "10");
    setValue(field("invoice-description"), "Quote visit");
    setValue(select, "quote:q1");
    await submit();
    expect(createInvoice).toHaveBeenCalledWith(ACCOUNT_ID, expect.objectContaining({ bookingId: null, quoteId: "q1" }));
  });

  it("labels every field, and the due date can't be before the issue date", async () => {
    invoices();
    await click(button("Add invoice"));
    for (const id of ["invoice-amount", "invoice-for", "invoice-description", "invoice-issued", "invoice-due"]) {
      expect(container.querySelector(`label[for="${id}"]`), id).not.toBeNull();
    }
    expect(field("invoice-due").getAttribute("min")).toBe(TODAY);
    expect(container.textContent).toContain("can't be edited");
  });

  it("keeps the form open and announces the server's error", async () => {
    createInvoice.mockResolvedValue({ success: false, error: "Enter an amount in dollars, like 125.00, up to $1,000,000.00." });
    invoices();
    await click(button("Add invoice"));
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Enter an amount");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("marks an open invoice paid with a date and a note", async () => {
    invoices([INVOICE]);
    await click(button("Mark paid"));
    expect((field("paid-on-i-1") as HTMLInputElement).value).toBe(TODAY);
    expect(field("paid-on-i-1").getAttribute("max")).toBe(TODAY);
    setValue(field("paid-on-i-1"), "2026-11-05");
    setValue(field("paid-note-i-1"), "Check #1042");
    await submit(container.querySelectorAll("form")[0]);
    expect(markInvoicePaid).toHaveBeenCalledWith("i-1", { paidOn: "2026-11-05", note: "Check #1042" });
    expect(refresh).toHaveBeenCalled();
  });

  it("asks before cancelling an invoice, and can back out", async () => {
    invoices([INVOICE]);
    await click(button("Cancel invoice"));
    expect(voidInvoice).not.toHaveBeenCalled();
    await click(button("Keep it"));
    expect(button("Yes, cancel this invoice")).toBeUndefined();

    await click(button("Cancel invoice"));
    await click(button("Yes, cancel this invoice"));
    expect(voidInvoice).toHaveBeenCalledWith("i-1");
  });

  it("undoes a payment, and offers no actions on a cancelled invoice", async () => {
    invoices([{ ...INVOICE, status: "paid", paidLabel: "November 5, 2026", paymentNote: "Check #1042" }]);
    expect(container.textContent).toContain("Payment note: Check #1042");
    await click(button("Undo payment"));
    expect(reopenInvoice).toHaveBeenCalledWith("i-1");

    act(() => root.unmount());
    root = createRoot(container);
    invoices([{ ...INVOICE, status: "void" }]);
    expect(button("Mark paid")).toBeUndefined();
    expect(button("Undo payment")).toBeUndefined();
    expect(container.textContent).toContain("Cancelled");
  });

  it("shows a refused status change", async () => {
    voidInvoice.mockResolvedValue({ success: false, error: "This invoice changed since you loaded the page. Refresh and try again." });
    invoices([INVOICE]);
    await click(button("Cancel invoice"));
    await click(button("Yes, cancel this invoice"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("changed since you loaded");
  });

  it("gives each row's buttons a name that says which invoice", () => {
    invoices([INVOICE]);
    expect(button("Mark paid INV-1007")).toBeDefined();
    expect(button("Cancel invoice INV-1007")).toBeDefined();
  });
});

describe("LinkBookingForm", () => {
  it("links the booking number typed, clears the field and refreshes", async () => {
    render(<LinkBookingForm accountId={ACCOUNT_ID} />);
    expect(container.querySelector('label[for="link-booking"]')?.textContent).toBe("Link another booking");
    setValue(field("link-booking"), "AOC-1043");
    await submit();
    expect(linkBookingToAccount).toHaveBeenCalledWith(ACCOUNT_ID, "AOC-1043");
    expect(refresh).toHaveBeenCalled();
    expect((field("link-booking") as HTMLInputElement).value).toBe("");
  });

  it("is disabled until something is typed", () => {
    render(<LinkBookingForm accountId={ACCOUNT_ID} />);
    expect(button("Link")!.disabled).toBe(true);
  });

  it("announces why it couldn't link", async () => {
    linkBookingToAccount.mockResolvedValue({ success: false, error: "There is no booking AOC-9999." });
    render(<LinkBookingForm accountId={ACCOUNT_ID} />);
    setValue(field("link-booking"), "9999");
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("no booking AOC-9999");
    expect(refresh).not.toHaveBeenCalled();
  });
});
