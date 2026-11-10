import AccountLoadError from "@/components/account/AccountLoadError";
import BalanceCard from "@/components/account/BalanceCard";
import InvoiceList from "@/components/account/InvoiceList";
import { BUSINESS_PHONE } from "@/lib/constants";
import { prepareInvoices } from "@/lib/customer-billing";
import { nyTodayStr } from "@/lib/datetime";
import { getCustomerAccount, getCustomerInvoices } from "@/lib/supabase/customer-queries";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const heading = <h1 className="text-2xl font-bold text-ink">Billing</h1>;

  const accountResult = await getCustomerAccount();
  if (!accountResult.ok) {
    return (
      <>
        {heading}
        <AccountLoadError what="your account" />
      </>
    );
  }
  const account = accountResult.data;
  if (!account) {
    return (
      <>
        {heading}
        <p className="text-sm text-ink-muted">This login isn&apos;t linked to a customer account.</p>
      </>
    );
  }

  const invoicesResult = await getCustomerInvoices(account.id);
  if (!invoicesResult.ok) {
    return (
      <>
        {heading}
        <AccountLoadError what="your invoices" />
      </>
    );
  }

  if (invoicesResult.data.length === 0) {
    return (
      <>
        {heading}
        <p className="rounded-xl border border-line bg-white p-5 text-sm text-ink-muted">
          No invoices yet. When we send you one, it will show up here.
        </p>
      </>
    );
  }

  const { open, history, balanceCents, overdueCount } = prepareInvoices(invoicesResult.data, nyTodayStr());

  return (
    <>
      {heading}

      <BalanceCard balanceCents={balanceCents} openCount={open.length} overdueCount={overdueCount} />

      <p className="text-sm text-ink-muted">
        To pay an invoice or ask about a charge, call us at{" "}
        <a href={BUSINESS_PHONE.tel} className="font-semibold text-primary underline underline-offset-2">
          {BUSINESS_PHONE.display}
        </a>
        .
      </p>

      {open.length > 0 && (
        <section aria-labelledby="open-invoices" className="flex flex-col gap-3">
          <h2 id="open-invoices" className="text-lg font-semibold text-ink">
            Open invoices
          </h2>
          <InvoiceList invoices={open} label="Open invoices" />
        </section>
      )}

      {history.length > 0 && (
        <section aria-labelledby="invoice-history" className="flex flex-col gap-3">
          <h2 id="invoice-history" className="text-lg font-semibold text-ink">
            History
          </h2>
          <InvoiceList invoices={history} label="Invoice history" />
        </section>
      )}
    </>
  );
}
