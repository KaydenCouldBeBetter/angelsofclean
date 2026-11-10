import { notFound } from "next/navigation";
import AccountLoadError from "@/components/account/AccountLoadError";
import LocationList from "@/components/account/LocationList";
import { deriveLocations } from "@/lib/customer-locations";
import { nyTodayStr } from "@/lib/datetime";
import {
  getCustomerAccount,
  getCustomerVisits,
  getServicePlans,
} from "@/lib/supabase/customer-queries";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const heading = <h1 className="text-2xl font-bold text-ink">Locations</h1>;

  const accountResult = await getCustomerAccount();
  if (!accountResult.ok) {
    return (
      <>
        {heading}
        <AccountLoadError what="your account" />
      </>
    );
  }
  if (accountResult.data?.type !== "commercial") notFound();

  const [visitsResult, plansResult] = await Promise.all([
    getCustomerVisits(accountResult.data.id),
    getServicePlans(accountResult.data.id),
  ]);
  if (!visitsResult.ok || !plansResult.ok) {
    return (
      <>
        {heading}
        <AccountLoadError what="your locations" />
      </>
    );
  }

  const locations = deriveLocations(visitsResult.data, plansResult.data, nyTodayStr());

  return (
    <>
      {heading}
      <p className="text-sm text-ink-muted">Every address we clean for you, with its plan and visits.</p>
      {locations.length === 0 ? (
        <p className="rounded-xl border border-line bg-white p-5 text-sm text-ink-muted">
          No locations yet. Once we schedule service, each address shows up here.
        </p>
      ) : (
        <LocationList locations={locations} />
      )}
    </>
  );
}
