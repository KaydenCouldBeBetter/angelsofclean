"use client";

import { useBookingStore } from "@/store/bookingStore";
import { FREQUENCY_LABELS, SERVICE_LABELS, TIME_LABELS } from "@/lib/constants";
import { formatBookingDate } from "@/lib/booking-date";

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
      value: `${formatBookingDate(store.date, "short")} \u00B7 ${TIME_LABELS[store.timeSlot] ?? store.timeSlot}`,
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
            <p className="text-sm text-zinc-500">
              Your selections will appear here as you complete each step.
            </p>
          ) : (
            <div className="flex flex-col">
              {rows.map((row, i) => (
                <div key={row.label}>
                  <div className="py-2">
                    <p className="text-xs text-zinc-500">{row.label}</p>
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
