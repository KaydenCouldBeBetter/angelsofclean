import { CalendarClock } from "lucide-react";
import { PLAN_STATUS_CHIP } from "@/lib/customer-status";
import type { ServicePlan } from "@/lib/customer-types";
import { cn } from "@/lib/utils";

// A recurring service the customer has with us. A paused plan says so in words.
export default function PlanCard({ plan }: { plan: ServicePlan }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-white p-4">
      <CalendarClock aria-hidden="true" className="mt-0.5 size-5 flex-shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">
          {plan.frequencyLabel} · {plan.serviceLabel}
        </p>
        <p className="truncate text-sm text-ink-muted">
          {plan.address}, {plan.cityLine}
        </p>
        {plan.notes && <p className="mt-1 whitespace-pre-line break-words text-sm text-ink">{plan.notes}</p>}
      </div>
      <span
        className={cn(
          "flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
          PLAN_STATUS_CHIP[plan.status].chipBg,
          PLAN_STATUS_CHIP[plan.status].chipText,
        )}
      >
        {plan.statusLabel}
      </span>
    </div>
  );
}
