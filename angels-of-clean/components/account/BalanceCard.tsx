import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { formatCents } from "@/lib/money";

// What is owed. Both the billing page and the overview show it; `balanceCents`
// is the sum of the open invoices (see prepareInvoices).
export default function BalanceCard({
  balanceCents,
  openCount,
  overdueCount,
  href,
}: {
  balanceCents: number;
  openCount: number;
  overdueCount: number;
  /** Where "View billing" goes; leave out on the billing page itself. */
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-white p-5">
      <p className="text-sm text-ink-muted">Balance due</p>
      <p className="text-3xl font-bold text-ink">{formatCents(balanceCents)}</p>
      {openCount === 0 ? (
        <p className="text-sm text-ink-muted">You&apos;re all paid up.</p>
      ) : (
        <p className="text-sm text-ink-muted">
          {openCount} open {openCount === 1 ? "invoice" : "invoices"}
        </p>
      )}
      {overdueCount > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#c0392b]">
          <CircleAlert aria-hidden="true" className="size-4" />
          {overdueCount} past due
        </p>
      )}
      {href && (
        <Link
          href={href}
          className="mt-1 inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary hover:underline"
        >
          View billing
        </Link>
      )}
    </div>
  );
}
