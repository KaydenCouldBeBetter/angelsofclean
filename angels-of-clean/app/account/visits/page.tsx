import AccountLoadError from "@/components/account/AccountLoadError";
import EmptyState from "@/components/account/EmptyState";
import PlanCard from "@/components/account/PlanCard";
import VisitList from "@/components/account/VisitList";
import { splitVisits } from "@/lib/customer-visits";
import { nyTodayStr } from "@/lib/datetime";
import {
  getCustomerAccount,
  getCustomerVisits,
  getServicePlans,
} from "@/lib/supabase/customer-queries";

export const metadata = { title: "Visits" };

// Past visits are shown newest first; this many, then a note.
const PAST_LIMIT = 50;

export default async function VisitsPage() {
  const heading = <h1 className="text-2xl font-bold text-ink">Visits</h1>;

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

  const [visitsResult, plansResult] = await Promise.all([
    getCustomerVisits(account.id),
    getServicePlans(account.id),
  ]);
  if (!visitsResult.ok || !plansResult.ok) {
    return (
      <>
        {heading}
        <AccountLoadError what="your visits" />
      </>
    );
  }

  const isCommercial = account.type === "commercial";
  if (visitsResult.data.length === 0 && plansResult.data.length === 0) {
    return (
      <>
        {heading}
        <EmptyState
          heading="No bookings yet"
          body={
            isCommercial
              ? "Once we've scheduled your service, your visits will show up here."
              : "Book your first cleaning and it will show up here."
          }
          actionHref={isCommercial ? "/commercial" : "/residential"}
          actionLabel={isCommercial ? "Get a commercial quote" : "Book a cleaning"}
        />
      </>
    );
  }

  const { upcoming, past } = splitVisits(visitsResult.data, nyTodayStr());
  const shownPast = past.slice(0, PAST_LIMIT);

  return (
    <>
      {heading}

      {plansResult.data.length > 0 && (
        <section aria-labelledby="plans" className="flex flex-col gap-3">
          <h2 id="plans" className="text-lg font-semibold text-ink">
            Your service plan
          </h2>
          {plansResult.data.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </section>
      )}

      <section aria-labelledby="upcoming" className="flex flex-col gap-3">
        <h2 id="upcoming" className="text-lg font-semibold text-ink">
          Upcoming
        </h2>
        {upcoming.length > 0 ? (
          <VisitList visits={upcoming} label="Upcoming visits" />
        ) : (
          <p className="rounded-xl border border-line bg-white p-5 text-sm text-ink-muted">
            You don&apos;t have a visit coming up.
          </p>
        )}
      </section>

      {shownPast.length > 0 && (
        <section aria-labelledby="past" className="flex flex-col gap-3">
          <h2 id="past" className="text-lg font-semibold text-ink">
            Past visits
          </h2>
          <VisitList visits={shownPast} label="Past visits" />
          {past.length > PAST_LIMIT && (
            <p className="text-sm text-ink-muted">
              Showing your {PAST_LIMIT} most recent visits.
            </p>
          )}
        </section>
      )}
    </>
  );
}
