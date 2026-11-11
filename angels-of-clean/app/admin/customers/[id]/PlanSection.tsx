"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { COMMERCIAL_FREQUENCY_LABELS, FIELD_MAX_LENGTHS, SERVICE_LABELS } from "@/lib/constants";
import { PLAN_FREQUENCIES, PLAN_SERVICE_TYPES, type PlanFrequency, type PlanServiceType, type PlanStatus } from "@/lib/admin-customers";
import type { AdminPlan } from "@/lib/admin-customer-types";
import { PLAN_STATUS_CHIP } from "@/lib/customer-status";
import { createServicePlan, setServicePlanStatus } from "../actions";
import { DANGER_BUTTON, Field, FormError, INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./form-ui";

const SERVICE_OPTION_LABELS: Record<PlanServiceType, string> = {
  ...SERVICE_LABELS,
  commercial: "Commercial cleaning",
};

export default function PlanSection({
  accountId,
  accountType,
  plans,
}: {
  accountId: string;
  accountType: "residential" | "commercial";
  plans: AdminPlan[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [serviceType, setServiceType] = useState<PlanServiceType>(
    accountType === "commercial" ? "commercial" : "standard",
  );
  const [frequency, setFrequency] = useState<PlanFrequency>("bi-weekly");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmingEnd, setConfirmingEnd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createServicePlan(accountId, { serviceType, frequency, address, city, zip, notes });
      if (result.success) {
        setAdding(false);
        setAddress("");
        setCity("");
        setZip("");
        setNotes("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function changeStatus(planId: string, status: PlanStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setServicePlanStatus(planId, status);
      setConfirmingEnd(null);
      if (result.success) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <section aria-labelledby="plans" className="bg-white border border-[#e2e8e6] rounded-xl">
      <div className="px-6 py-4 flex items-center justify-between gap-4 border-b border-[#e2e8e6]">
        <div>
          <h2 id="plans" className="font-semibold text-[17px] text-[#1c1c1e]">
            Service plans
          </h2>
          <p className="text-xs text-[#5c5c5e] mt-0.5">The recurring service the customer sees on their account.</p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={SECONDARY_BUTTON}>
            Add plan
          </button>
        )}
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">
        {error && <FormError>{error}</FormError>}

        {plans.length === 0 && !adding && (
          <p className="text-[13px] text-[#5c5c5e]">No service plan yet.</p>
        )}

        {plans.length > 0 && (
          <ul className="flex flex-col gap-3">
            {plans.map((plan) => (
              <li key={plan.id} className="rounded-lg border border-[#e2e8e6] p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#1c1c1e]">
                      {plan.frequencyLabel} · {plan.serviceLabel}
                    </p>
                    <p className="text-[13px] text-[#5c5c5e]">
                      {plan.address}, {plan.city}, {plan.zip}
                    </p>
                    {plan.notes && <p className="text-[13px] text-[#1c1c1e] mt-1 whitespace-pre-line">{plan.notes}</p>}
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      plan.status === "ended"
                        ? "bg-[#f7f9f8] text-[#5c5c5e]"
                        : `${PLAN_STATUS_CHIP[plan.status].chipBg} ${PLAN_STATUS_CHIP[plan.status].chipText}`
                    }`}
                  >
                    {plan.statusLabel}
                  </span>
                </div>

                {plan.status !== "ended" && (
                  <div className="flex flex-wrap gap-2">
                    {plan.status === "active" ? (
                      <button type="button" disabled={isPending} onClick={() => changeStatus(plan.id, "paused")} className={SECONDARY_BUTTON}>
                        Pause<span className="sr-only"> plan</span>
                      </button>
                    ) : (
                      <button type="button" disabled={isPending} onClick={() => changeStatus(plan.id, "active")} className={SECONDARY_BUTTON}>
                        Resume<span className="sr-only"> plan</span>
                      </button>
                    )}
                    {confirmingEnd === plan.id ? (
                      <>
                        <button type="button" disabled={isPending} onClick={() => changeStatus(plan.id, "ended")} className={DANGER_BUTTON}>
                          Yes, end this plan
                        </button>
                        <button type="button" onClick={() => setConfirmingEnd(null)} className={SECONDARY_BUTTON}>
                          Keep it
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmingEnd(plan.id)} className={DANGER_BUTTON}>
                        End plan
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {adding && (
          <form onSubmit={handleCreate} className="rounded-lg border border-[#e2e8e6] bg-[#f7f9f8] p-4 flex flex-col gap-4">
            <h3 className="font-semibold text-[15px] text-[#1c1c1e]">New service plan</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field id="plan-service" label="Service">
                <select id="plan-service" value={serviceType} onChange={(e) => setServiceType(e.target.value as PlanServiceType)} className={INPUT_CLASS}>
                  {PLAN_SERVICE_TYPES.map((type) => (
                    <option key={type} value={type}>{SERVICE_OPTION_LABELS[type]}</option>
                  ))}
                </select>
              </Field>
              <Field id="plan-frequency" label="How often">
                <select id="plan-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as PlanFrequency)} className={INPUT_CLASS}>
                  {PLAN_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{COMMERCIAL_FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field id="plan-address" label="Service address">
              <input id="plan-address" required maxLength={FIELD_MAX_LENGTHS.address} value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT_CLASS} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="plan-city" label="City">
                <input id="plan-city" required maxLength={FIELD_MAX_LENGTHS.city} value={city} onChange={(e) => setCity(e.target.value)} className={INPUT_CLASS} />
              </Field>
              <Field id="plan-zip" label="ZIP code">
                <input id="plan-zip" required inputMode="numeric" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value)} className={INPUT_CLASS} />
              </Field>
            </div>
            <Field id="plan-notes" label="Notes (optional)" hint="The customer sees these on their account.">
              <textarea id="plan-notes" maxLength={FIELD_MAX_LENGTHS.notes} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-[#c9d3cf] bg-white px-3 py-2 text-sm text-[#1c1c1e]" />
            </Field>
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
                {isPending ? "Saving…" : "Save plan"}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError(null); }} className={SECONDARY_BUTTON}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
