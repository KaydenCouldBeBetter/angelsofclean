import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import AccountLoadError from "@/components/account/AccountLoadError";
import StatusChip from "@/components/account/StatusChip";
import { BUSINESS_PHONE } from "@/lib/constants";
import { CUSTOMER_STATUS } from "@/lib/customer-status";
import { getCustomerAccount, getCustomerVisit } from "@/lib/supabase/customer-queries";

export const metadata = { title: "Visit" };

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const accountResult = await getCustomerAccount();
  if (!accountResult.ok) return <AccountLoadError what="your account" />;
  if (!accountResult.data) notFound();

  const visitResult = await getCustomerVisit(accountResult.data.id, id);
  if (!visitResult.ok) return <AccountLoadError what="this visit" />;
  // Not theirs and not real look the same.
  if (!visitResult.data) notFound();

  const visit = visitResult.data;
  const open = visit.status === "pending" || visit.status === "confirmed";

  const details: [string, string][] = [
    ["Date", visit.dateLabel],
    ["Time", visit.timeLabel],
    ["Address", `${visit.address}, ${visit.cityLine}`],
    ["Home", `${visit.bedrooms} ${visit.bedrooms === 1 ? "Bedroom" : "Bedrooms"} · ${visit.bathroomsLabel}`],
    ["How often", visit.frequencyLabel],
    ["Booking number", visit.ref],
  ];

  return (
    <>
      <Link
        href="/account/visits"
        className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        All visits
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-ink">{visit.serviceLabel}</h1>
        <div className="flex flex-col items-start gap-2">
          <StatusChip status={visit.status} />
          <p className="text-sm text-ink-muted">{CUSTOMER_STATUS[visit.status].description}</p>
        </div>
      </div>

      <dl className="divide-y divide-line rounded-xl border border-line bg-white">
        {details.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:gap-4">
            <dt className="text-sm text-ink-muted sm:w-40 sm:flex-shrink-0">{label}</dt>
            <dd className="text-sm font-medium text-ink">{value}</dd>
          </div>
        ))}
        {visit.notes && (
          <div className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:gap-4">
            <dt className="text-sm text-ink-muted sm:w-40 sm:flex-shrink-0">Your notes</dt>
            <dd className="whitespace-pre-line text-sm font-medium text-ink">{visit.notes}</dd>
          </div>
        )}
      </dl>

      <p className="text-sm text-ink-muted">
        {open
          ? "Need to change or cancel this visit? Call us at "
          : visit.status === "cancelled"
            ? "To rebook, call us at "
            : "Questions about this visit? Call us at "}
        <a href={BUSINESS_PHONE.tel} className="font-semibold text-primary underline underline-offset-2">
          {BUSINESS_PHONE.display}
        </a>
        .
      </p>
    </>
  );
}
