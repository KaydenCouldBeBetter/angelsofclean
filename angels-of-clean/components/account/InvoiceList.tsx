import Link from "next/link";
import { ChevronRight } from "lucide-react";
import InvoiceChip from "@/components/account/InvoiceChip";
import type { BilledInvoice } from "@/lib/customer-types";

// What the second line says, by status. Dates are the stored New York days.
function dateLine(invoice: BilledInvoice): string {
  switch (invoice.display) {
    case "open":
      return `Due ${invoice.dueLabel}`;
    case "overdue":
      return `Was due ${invoice.dueLabel}`;
    case "paid":
      return invoice.paidLabel ? `Paid ${invoice.paidLabel}` : "Paid";
    case "void":
      return `Issued ${invoice.issuedLabel}`;
  }
}

// One card per invoice; the whole card opens it.
export default function InvoiceList({ invoices, label }: { invoices: BilledInvoice[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          <Link
            href={`/account/billing/${invoice.id}`}
            className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 hover:border-primary/40"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">
                {invoice.number} <span className="font-normal text-ink-muted">· {dateLine(invoice)}</span>
              </p>
              <p className="truncate text-sm text-ink-muted">{invoice.description}</p>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-1">
              <p className="font-semibold text-ink">{invoice.amountLabel}</p>
              <InvoiceChip display={invoice.display} />
            </div>
            <ChevronRight aria-hidden="true" className="size-5 flex-shrink-0 text-ink-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
