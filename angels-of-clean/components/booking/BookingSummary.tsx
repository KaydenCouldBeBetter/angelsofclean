"use client";

import { useBookingStore } from "@/store/bookingStore";

const SERVICE_LABELS: Record<string, string> = {
  standard: "Standard Clean",
  deep: "Deep Clean",
  moveinout: "Move-In / Move-Out",
};

const FREQUENCY_LABELS: Record<string, string> = {
  "one-time": "One-time",
  weekly: "Weekly",
  "bi-weekly": "Bi-weekly",
  monthly: "Monthly",
};

const TIMESLOT_LABELS: Record<string, string> = {
  morning: "Morning (8am\u201312pm)",
  afternoon: "Afternoon (12pm\u20134pm)",
};

function formatSummaryDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface SummaryRow {
  label: string;
  value: string;
}

export default function BookingSummary() {
  const store = useBookingStore();

  const rows: SummaryRow[] = [];

  // Service (after step 1)
  if (store.service) {
    const freq = store.frequency ? FREQUENCY_LABELS[store.frequency] : "";
    rows.push({
      label: "Service",
      value: `${SERVICE_LABELS[store.service]}${freq ? ` \u00B7 ${freq}` : ""}`,
    });
  }

  // Address (after step 2)
  if (store.address && store.city && store.zip) {
    rows.push({
      label: "Address",
      value: `${store.address}, ${store.city}, NY ${store.zip}`,
    });
  }

  // Property (after step 3)
  if (store.service && store.address && store.bedrooms > 0) {
    rows.push({
      label: "Property",
      value: `${store.bedrooms} Bed, ${store.bathrooms} Bath`,
    });
  }

  // Date & Time (after step 4)
  if (store.date && store.timeSlot) {
    rows.push({
      label: "Date & Time",
      value: `${formatSummaryDate(store.date)} \u00B7 ${TIMESLOT_LABELS[store.timeSlot] ?? store.timeSlot}`,
    });
  }

  return (
    <div className="hidden lg:block w-[340px] flex-shrink-0">
      <div className="border border-zinc-200 rounded-xl bg-white">
        <div className="px-6 py-5">
          <h2 className="font-semibold text-lg text-zinc-900">
            Booking Summary
          </h2>
        </div>

        <div className="h-px bg-zinc-200 mx-6" />

        <div className="px-6 py-5">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Your selections will appear here as you complete each step.
            </p>
          ) : (
            <div className="flex flex-col">
              {rows.map((row, i) => (
                <div key={row.label}>
                  <div className="py-2">
                    <p className="text-xs text-zinc-400">{row.label}</p>
                    <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                      {row.value}
                    </p>
                  </div>
                  {i < rows.length - 1 && (
                    <div className="h-px bg-zinc-200" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
