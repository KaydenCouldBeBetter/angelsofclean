import Link from "next/link";
import { ChevronRight } from "lucide-react";
import StatusChip from "@/components/account/StatusChip";
import type { Visit } from "@/lib/customer-types";

// One card per visit; the whole card opens the visit.
export default function VisitList({ visits, label }: { visits: Visit[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {visits.map((visit) => (
        <li key={visit.id}>
          <Link
            href={`/account/visits/${visit.id}`}
            className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 hover:border-primary/40"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{visit.dateLabel}</p>
              <p className="text-sm text-ink-muted">
                {visit.timeLabel} · {visit.serviceLabel}
              </p>
              <p className="truncate text-sm text-ink-muted">{visit.address}</p>
            </div>
            <StatusChip status={visit.status} className="flex-shrink-0" />
            <ChevronRight aria-hidden="true" className="size-5 flex-shrink-0 text-ink-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
