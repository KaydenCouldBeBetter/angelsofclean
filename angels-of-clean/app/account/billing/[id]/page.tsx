import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import AccountLoadError from "@/components/account/AccountLoadError";
import InvoiceChip from "@/components/account/InvoiceChip";
import { BUSINESS_PHONE } from "@/lib/constants";
import { invoiceDisplayStatus } from "@/lib/customer-billing";
import { nyTodayStr } from "@/lib/datetime";
import { getCustomerAccount, getCustomerInvoice } from "@/lib/supabase/customer-queries";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const accountResult = await getCustomerAccount();
  if (!accountResult.ok) return <AccountLoadError what="your account" />;
  if (!accountResult.data) notFound();

  const invoiceResult = await getCustomerInvoice(accountResult.data.id, id);
  if (!invoiceResult.ok) return <AccountLoadError what="this invoice" />;
  // Not theirs and not real look the same.
  if (!invoiceResult.data) notFound();

  const invoice = invoiceResult.data;
  const display = invoiceDisplayStatus(invoice, nyTodayStr());

  const details: [string, React.ReactNode][] = [
    ["Invoice number", invoice.number],
    ["For", invoice.description],
    ["Issued", invoice.issuedLabel],
  ];
  if (invoice.status === "paid") {
    details.push(["Paid", invoice.paidLabel ?? "Yes"]);
  } else if (invoice.status === "open") {
    details.push(["Due", invoice.dueLabel]);
  }
  if (invoice.paymentNote) details.push(["Payment note", invoice.paymentNote]);
  if (invoice.visit) {
    details.push([
      "Visit",
      <Link
        key="visit"
        href={`/account/visits/${invoice.visit.id}`}
        className="font-semibold text-primary underline underline-offset-2"
      >
        {invoice.visit.label}
      </Link>,
    ]);
  }
  if (invoice.quoteRef) details.push(["Quote request", invoice.quoteRef]);

  return (
    <>
      <Link
        href="/account/billing"
        className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        All invoices
      </Link>

      <div className="flex flex-col items-start gap-2">
        <h1 className="text-2xl font-bold text-ink">Invoice {invoice.number}</h1>
        <p className="text-3xl font-bold text-ink">{invoice.amountLabel}</p>
        <InvoiceChip display={display} />
        {display === "overdue" && (
          <p className="text-sm text-ink-muted">This invoice was due on {invoice.dueLabel}.</p>
        )}
        {display === "void" && (
          <p className="text-sm text-ink-muted">This invoice was cancelled. Nothing is owed on it.</p>
        )}
      </div>

      <dl className="divide-y divide-line rounded-xl border border-line bg-white">
        {details.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:gap-4">
            <dt className="text-sm text-ink-muted sm:w-40 sm:flex-shrink-0">{label}</dt>
            <dd className="text-sm font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-sm text-ink-muted">
        {invoice.status === "open"
          ? "To pay this invoice or ask about it, call us at "
          : "Questions about this invoice? Call us at "}
        <a href={BUSINESS_PHONE.tel} className="font-semibold text-primary underline underline-offset-2">
          {BUSINESS_PHONE.display}
        </a>
        .
      </p>
    </>
  );
}
