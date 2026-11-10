import Link from "next/link";
import AccountLoadError from "@/components/account/AccountLoadError";
import EmptyState from "@/components/account/EmptyState";
import InviteNotice from "@/components/account/InviteNotice";
import PlanCard from "@/components/account/PlanCard";
import StatusChip from "@/components/account/StatusChip";
import VisitList from "@/components/account/VisitList";
import AuthAlert from "@/components/auth/AuthAlert";
import { BUSINESS_PHONE } from "@/lib/constants";
import { splitVisits } from "@/lib/customer-visits";
import { nyTodayStr } from "@/lib/datetime";
import { parseInviteNotice } from "@/lib/supabase/customer-session";
import {
  claimCustomerRecords,
  getCustomerAccount,
  getCustomerVisits,
  getServicePlans,
} from "@/lib/supabase/customer-queries";

export const metadata = { title: "Overview" };

const RECENT_COUNT = 3;

export default async function AccountOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const notice = parseInviteNotice((await searchParams).invite);

  // Picks up bookings made since sign-up before anything is read.
  await claimCustomerRecords();
  const accountResult = await getCustomerAccount();

  if (!accountResult.ok) {
    return (
      <>
        <h1 className="text-2xl font-bold text-ink">Overview</h1>
        <AccountLoadError what="your account" />
      </>
    );
  }

  const account = accountResult.data;
  if (!account) {
    return (
      <>
        <h1 className="text-2xl font-bold text-ink">Overview</h1>
        {notice && <InviteNotice status={notice} />}
        <AuthAlert tone="info">
          This login isn&apos;t linked to a customer account. If you work for Angels of Clean, use the{" "}
          <Link href="/admin/dashboard" className="font-semibold text-primary underline underline-offset-2">
            admin portal
          </Link>
          .
        </AuthAlert>
      </>
    );
  }

  const [visitsResult, plansResult] = await Promise.all([
    getCustomerVisits(account.id),
    getServicePlans(account.id),
  ]);

  const heading = <h1 className="text-2xl font-bold text-ink">Welcome, {account.name}</h1>;

  if (!visitsResult.ok || !plansResult.ok) {
    return (
      <>
        {heading}
        {notice && <InviteNotice status={notice} />}
        <AccountLoadError what="your visits" />
      </>
    );
  }

  const { upcoming, past } = splitVisits(visitsResult.data, nyTodayStr());
  const plans = plansResult.data;
  const next = upcoming[0];
  const isCommercial = account.type === "commercial";

  if (visitsResult.data.length === 0 && plans.length === 0) {
    return (
      <>
        {heading}
        {notice && <InviteNotice status={notice} />}
        <EmptyState
          heading="No bookings yet"
          body={
            isCommercial
              ? "Once we've scheduled your service, your visits and plan will show up here."
              : "Book your first cleaning and it will show up here."
          }
          actionHref={isCommercial ? "/commercial" : "/residential"}
          actionLabel={isCommercial ? "Get a commercial quote" : "Book a cleaning"}
        />
      </>
    );
  }

  return (
    <>
      {heading}
      {notice && <InviteNotice status={notice} />}

      <section aria-labelledby="next-visit" className="flex flex-col gap-3">
        <h2 id="next-visit" className="text-lg font-semibold text-ink">
          Next visit
        </h2>
        {next ? (
          <Link
            href={`/account/visits/${next.id}`}
            className="flex flex-col gap-2 rounded-xl border border-line bg-white p-5 hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xl font-bold text-ink">{next.dateLabel}</p>
              <StatusChip status={next.status} className="flex-shrink-0" />
            </div>
            <p className="text-sm text-ink-muted">
              {next.timeLabel} · {next.serviceLabel}
            </p>
            <p className="text-sm text-ink-muted">
              {next.address}, {next.cityLine}
            </p>
          </Link>
        ) : (
          <div className="rounded-xl border border-line bg-white p-5 text-sm text-ink-muted">
            <p>You don&apos;t have a visit coming up.</p>
            <Link
              href={isCommercial ? "/commercial" : "/residential"}
              className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
            >
              {isCommercial ? "Get a commercial quote" : "Book a cleaning"}
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="service-plan" className="flex flex-col gap-3">
        <h2 id="service-plan" className="text-lg font-semibold text-ink">
          Service plan
        </h2>
        {plans.length > 0 ? (
          plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)
        ) : (
          <p className="rounded-xl border border-line bg-white p-5 text-sm text-ink-muted">
            You don&apos;t have a recurring plan yet. To set up regular cleanings, call us at{" "}
            <a href={BUSINESS_PHONE.tel} className="font-semibold text-primary underline underline-offset-2">
              {BUSINESS_PHONE.display}
            </a>
            .
          </p>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="recent-visits" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-visits" className="text-lg font-semibold text-ink">
              Recent visits
            </h2>
            <Link
              href="/account/visits"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              View all visits
            </Link>
          </div>
          <VisitList visits={past.slice(0, RECENT_COUNT)} label="Recent visits" />
        </section>
      )}

      <p className="text-sm text-ink-muted">
        Questions about a visit? Call us at{" "}
        <a href={BUSINESS_PHONE.tel} className="font-semibold text-primary underline underline-offset-2">
          {BUSINESS_PHONE.display}
        </a>
        .
      </p>
    </>
  );
}
