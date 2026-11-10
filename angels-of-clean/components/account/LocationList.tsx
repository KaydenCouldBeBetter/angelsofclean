import { MapPin } from "lucide-react";
import type { Location } from "@/lib/customer-locations";

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default function LocationList({ locations }: { locations: Location[] }) {
  return (
    <ul aria-label="Locations" className="flex flex-col gap-3">
      {locations.map((loc) => (
        <li key={loc.key} className="flex items-start gap-3 rounded-xl border border-line bg-white p-4">
          <MapPin aria-hidden="true" className="mt-0.5 size-5 flex-shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{loc.address}</p>
            <p className="text-sm text-ink-muted">{loc.cityLine}</p>
            {loc.plans.map((plan) => (
              <p key={plan} className="mt-1 text-sm text-ink">
                {plan}
              </p>
            ))}
            <p className="mt-1 text-sm text-ink-muted">
              {loc.nextVisitLabel ? `Next visit ${loc.nextVisitLabel}` : "No visit coming up"} ·{" "}
              {countLabel(loc.upcomingCount, "upcoming visit")}, {countLabel(loc.pastCount, "past visit")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
