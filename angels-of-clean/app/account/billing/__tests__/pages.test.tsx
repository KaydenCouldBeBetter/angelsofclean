import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CustomerAccount, Invoice, InvoiceDetail } from "@/lib/customer-types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

type Q<T> = { ok: true; data: T } | { ok: false };
const getCustomerAccount = vi.fn<() => Promise<Q<CustomerAccount | null>>>();
const getCustomerInvoices = vi.fn<(id: string) => Promise<Q<Invoice[]>>>();
const getCustomerInvoice = vi.fn<(a: string, id: string) => Promise<Q<InvoiceDetail | null>>>();
vi.mock("@/lib/supabase/customer-queries", () => ({
  getCustomerAccount: () => getCustomerAccount(),
  getCustomerInvoices: (id: string) => getCustomerInvoices(id),
  getCustomerInvoice: (a: string, id: string) => getCustomerInvoice(a, id),
}));

import BillingPage from "../page";
import InvoicePage from "../[id]/page";

const ACCOUNT: CustomerAccount = { id: "acc-1", name: "Alice Adams", type: "residential", role: "owner" };

let seq = 1000;
function invoice(over: Partial<InvoiceDetail>): InvoiceDetail {
  seq += 1;
  return {
    id: `inv-${seq}`,
    number: `INV-${seq}`,
    description: "Standard clean, Nov 2",
    amountCents: 12500,
    amountLabel: "$125.00",
    issuedOn: "2026-11-02",
    issuedLabel: "November 2, 2026",
    dueOn: "2026-11-30",
    dueLabel: "November 30, 2026",
    status: "open",
    paidLabel: null,
    paymentNote: null,
    visit: null,
    quoteRef: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  getCustomerAccount.mockResolvedValue({ ok: true, data: ACCOUNT });
  getCustomerInvoices.mockResolvedValue({ ok: true, data: [] });
  getCustomerInvoice.mockResolvedValue({ ok: true, data: invoice({}) });
});

describe("billing page", () => {
  const render = async () => renderToStaticMarkup(await BillingPage());

  it("says there are no invoices yet, instead of showing a zero balance", async () => {
    const html = await render();
    expect(html).toContain("No invoices yet");
    expect(html).not.toContain("Balance due");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("shows the balance, open invoices earliest due first, and history", async () => {
    getCustomerInvoices.mockResolvedValue({
      ok: true,
      data: [
        invoice({ id: "later", number: "INV-2", dueOn: "2026-12-15", dueLabel: "December 15, 2026" }),
        invoice({ id: "sooner", number: "INV-1", amountCents: 7550, amountLabel: "$75.50", dueOn: "2026-10-30", dueLabel: "October 30, 2026" }),
        invoice({ id: "done", number: "INV-0", status: "paid", paidLabel: "October 5, 2026", issuedOn: "2026-09-20", issuedLabel: "September 20, 2026" }),
        invoice({ id: "gone", number: "INV-9", status: "void", issuedOn: "2026-08-01" }),
      ],
    });
    const html = await render();

    expect(html).toContain("$200.50");
    expect(html).toContain("2 open invoices");
    expect(html).toContain("1 past due");

    const open = html.slice(html.indexOf('id="open-invoices"'), html.indexOf('id="invoice-history"'));
    expect(open.indexOf("/account/billing/sooner")).toBeGreaterThan(-1);
    expect(open.indexOf("/account/billing/sooner")).toBeLessThan(open.indexOf("/account/billing/later"));
    expect(open).toContain("Was due October 30, 2026");
    expect(open).toContain("Overdue");
    expect(open).toContain("Due December 15, 2026");

    const history = html.slice(html.indexOf('id="invoice-history"'));
    expect(history).toContain("Paid October 5, 2026");
    expect(history).toContain("Cancelled");
    expect(history).not.toContain("$200.50");
  });

  it("does not count a paid or cancelled invoice in the balance", async () => {
    getCustomerInvoices.mockResolvedValue({
      ok: true,
      data: [invoice({ status: "paid", paidLabel: "x", amountCents: 50000 }), invoice({ status: "void" })],
    });
    const html = await render();
    expect(html).toContain("$0.00");
    expect(html).toContain("all paid up");
    expect(html).not.toContain('id="open-invoices"');
  });

  it("tells the customer to call to pay, and promises no online payment or card", async () => {
    getCustomerInvoices.mockResolvedValue({ ok: true, data: [invoice({})] });
    const html = await render();
    expect(html).toContain("call us at");
    expect(html).toContain("tel:");
    expect(html).not.toMatch(/pay now|credit card|checkout|stripe/i);
  });

  it("reads this account's invoices only, and reports a failure as one", async () => {
    await render();
    expect(getCustomerInvoices).toHaveBeenCalledWith("acc-1");
    getCustomerInvoices.mockResolvedValue({ ok: false });
    const html = await render();
    expect(html).toContain("We couldn&#x27;t load your invoices");
    expect(html).not.toContain("No invoices yet");
  });

  it("explains a login with no customer account", async () => {
    getCustomerAccount.mockResolvedValue({ ok: true, data: null });
    expect(await render()).toContain("isn&#x27;t linked to a customer account");
    expect(getCustomerInvoices).not.toHaveBeenCalled();
  });
});

describe("invoice page", () => {
  const render = async (id = "inv-1") => renderToStaticMarkup(await InvoicePage({ params: Promise.resolve({ id }) }));

  it("shows the number, amount, what it is for and the dates", async () => {
    const html = await render();
    for (const text of ["Invoice INV-", "$125.00", "Standard clean, Nov 2", "November 2, 2026", "November 30, 2026", "Open"]) {
      expect(html, text).toContain(text);
    }
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("To pay this invoice or ask about it, call us at");
  });

  it("asks only for this account's invoice", async () => {
    await render("inv-1");
    expect(getCustomerInvoice).toHaveBeenCalledWith("acc-1", "inv-1");
  });

  it("flags an overdue invoice in words as well as colour", async () => {
    getCustomerInvoice.mockResolvedValue({ ok: true, data: invoice({ dueOn: "2026-11-01", dueLabel: "November 1, 2026" }) });
    const html = await render();
    expect(html).toContain("Overdue");
    expect(html).toContain("This invoice was due on November 1, 2026.");
  });

  it("shows when a paid invoice was paid and how, and no longer says it is due", async () => {
    getCustomerInvoice.mockResolvedValue({
      ok: true,
      data: invoice({ status: "paid", paidLabel: "November 5, 2026", paymentNote: "Check #1042" }),
    });
    const html = await render();
    expect(html).toContain("Paid");
    expect(html).toContain("November 5, 2026");
    expect(html).toContain("Check #1042");
    expect(html).not.toContain(">Due<");
    expect(html).toContain("Questions about this invoice?");
  });

  it("says a cancelled invoice owes nothing", async () => {
    getCustomerInvoice.mockResolvedValue({ ok: true, data: invoice({ status: "void" }) });
    const html = await render();
    expect(html).toContain("Cancelled");
    expect(html).toContain("Nothing is owed on it.");
  });

  it("links to the visit or names the quote it bills for", async () => {
    getCustomerInvoice.mockResolvedValue({
      ok: true,
      data: invoice({ visit: { id: "v-9", label: "Deep Clean on November 2, 2026" }, quoteRef: "COM-1007" }),
    });
    const html = await render();
    expect(html).toContain('href="/account/visits/v-9"');
    expect(html).toContain("Deep Clean on November 2, 2026");
    expect(html).toContain("COM-1007");
  });

  it("is a 404 for an invoice that isn't theirs or a login with no account", async () => {
    getCustomerInvoice.mockResolvedValue({ ok: true, data: null });
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    getCustomerAccount.mockResolvedValue({ ok: true, data: null });
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a load error, not a 404, when the lookup fails", async () => {
    getCustomerInvoice.mockResolvedValue({ ok: false });
    expect(await render()).toContain("We couldn&#x27;t load this invoice");
  });

  it("escapes the invoice text and the payment note", async () => {
    getCustomerInvoice.mockResolvedValue({
      ok: true,
      data: invoice({ description: "<img src=x onerror=alert(1)>", paymentNote: "<script>alert(2)</script>" }),
    });
    const html = await render();
    expect(html).not.toContain("<img");
    expect(html).not.toContain("alert(2)</script>");
  });

  it("never shows who at the office made it", async () => {
    expect(await render()).not.toMatch(/created by|admin@/i);
  });
});
