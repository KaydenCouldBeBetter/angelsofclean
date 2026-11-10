import { describe, expect, it } from "vitest";
import { invoiceDisplayStatus, prepareInvoices } from "../customer-billing";
import type { Invoice } from "../customer-types";

const TODAY = "2026-11-10";
let n = 1000;

function invoice(over: Partial<Invoice> & { dueOn: string }): Invoice {
  n += 1;
  return {
    id: `inv-${n}`,
    number: `INV-${n}`,
    description: "Standard clean",
    amountCents: 10000,
    amountLabel: "$100.00",
    issuedOn: "2026-10-01",
    issuedLabel: "October 1, 2026",
    dueLabel: over.dueOn,
    status: "open",
    paidLabel: null,
    ...over,
  };
}

describe("invoiceDisplayStatus", () => {
  it("is open until the due day has passed, and an invoice due today is still open", () => {
    expect(invoiceDisplayStatus(invoice({ dueOn: "2026-11-11" }), TODAY)).toBe("open");
    expect(invoiceDisplayStatus(invoice({ dueOn: "2026-11-10" }), TODAY)).toBe("open");
    expect(invoiceDisplayStatus(invoice({ dueOn: "2026-11-09" }), TODAY)).toBe("overdue");
  });

  it("never marks a paid or cancelled invoice overdue, however old", () => {
    expect(invoiceDisplayStatus(invoice({ dueOn: "2025-01-01", status: "paid" }), TODAY)).toBe("paid");
    expect(invoiceDisplayStatus(invoice({ dueOn: "2025-01-01", status: "void" }), TODAY)).toBe("void");
  });

  it("uses the date it is given, not the server's clock", () => {
    const i = invoice({ dueOn: "2026-11-10" });
    expect(invoiceDisplayStatus(i, "2026-11-10")).toBe("open");
    expect(invoiceDisplayStatus(i, "2026-11-11")).toBe("overdue");
  });
});

describe("prepareInvoices", () => {
  it("owes the sum of the open invoices, overdue ones included", () => {
    const result = prepareInvoices(
      [
        invoice({ dueOn: "2026-11-20", amountCents: 12500 }),
        invoice({ dueOn: "2026-10-20", amountCents: 7550 }),
        invoice({ dueOn: "2026-10-01", amountCents: 99999, status: "paid", paidLabel: "x" }),
        invoice({ dueOn: "2026-10-01", amountCents: 5000, status: "void" }),
      ],
      TODAY,
    );
    expect(result.balanceCents).toBe(20050);
    expect(result.open).toHaveLength(2);
    expect(result.overdueCount).toBe(1);
  });

  it("adds whole cents exactly", () => {
    const result = prepareInvoices(
      [10, 20, 30].map((cents) => invoice({ dueOn: "2026-12-01", amountCents: cents })),
      TODAY,
    );
    expect(result.balanceCents).toBe(60);
  });

  it("owes nothing when everything is paid or cancelled", () => {
    const result = prepareInvoices(
      [invoice({ dueOn: "2026-10-01", status: "paid" }), invoice({ dueOn: "2026-10-01", status: "void" })],
      TODAY,
    );
    expect(result).toMatchObject({ balanceCents: 0, overdueCount: 0, open: [] });
    expect(result.history).toHaveLength(2);
  });

  it("lists open invoices earliest due first, breaking a tie by number", () => {
    const a = invoice({ dueOn: "2026-12-01", number: "INV-1010" });
    const b = invoice({ dueOn: "2026-11-15", number: "INV-1009" });
    const c = invoice({ dueOn: "2026-12-01", number: "INV-999" });
    expect(prepareInvoices([a, b, c], TODAY).open.map((i) => i.number)).toEqual(["INV-1009", "INV-999", "INV-1010"]);
  });

  it("lists history newest first", () => {
    const old = invoice({ dueOn: "2026-08-01", issuedOn: "2026-07-01", status: "paid" });
    const recent = invoice({ dueOn: "2026-10-01", issuedOn: "2026-09-15", status: "void" });
    expect(prepareInvoices([old, recent], TODAY).history.map((i) => i.id)).toEqual([recent.id, old.id]);
  });

  it("attaches the display status to each invoice and does not change its input", () => {
    const input = [invoice({ dueOn: "2026-10-01" }), invoice({ dueOn: "2026-12-01" })];
    const copy = input.map((i) => ({ ...i }));
    const result = prepareInvoices(input, TODAY);
    expect(result.open.map((i) => i.display).sort()).toEqual(["open", "overdue"]);
    expect(input).toEqual(copy);
  });
});
