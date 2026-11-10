import type { BilledInvoice, Invoice, InvoiceDisplay } from "@/lib/customer-types";

/**
 * How an invoice is shown. Overdue isn't a stored status: an open invoice is
 * overdue once its due day has passed. `today` is the New York date
 * ("YYYY-MM-DD", nyTodayStr()), so the answer never depends on the server's zone,
 * and an invoice due today is still open.
 */
export function invoiceDisplayStatus(invoice: Invoice, today: string): InvoiceDisplay {
  if (invoice.status === "open") return invoice.dueOn < today ? "overdue" : "open";
  return invoice.status;
}

const byNumber = (a: Invoice, b: Invoice) => a.number.localeCompare(b.number, "en", { numeric: true });

export interface BillingSummary {
  /** Invoices still owed, the earliest due first. */
  open: BilledInvoice[];
  /** Paid and cancelled invoices, newest first. */
  history: BilledInvoice[];
  /** What is owed: the sum of the open invoices, overdue included. */
  balanceCents: number;
  overdueCount: number;
}

export function prepareInvoices(invoices: Invoice[], today: string): BillingSummary {
  const billed: BilledInvoice[] = invoices.map((invoice) => ({
    ...invoice,
    display: invoiceDisplayStatus(invoice, today),
  }));

  const open = billed
    .filter((i) => i.status === "open")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || byNumber(a, b));
  const history = billed
    .filter((i) => i.status !== "open")
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || byNumber(b, a));

  return {
    open,
    history,
    balanceCents: open.reduce((sum, i) => sum + i.amountCents, 0),
    overdueCount: open.filter((i) => i.display === "overdue").length,
  };
}
