"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CommercialNav from "@/components/booking/CommercialNav";
import { Button } from "@/components/ui/button";
import { useBookingStore } from "@/store/bookingStore";
import {
  FACILITY_TYPE_LABELS,
  SQFT_DISPLAY,
  COMMERCIAL_SERVICE_AREAS,
  COMMERCIAL_FREQUENCY_LABELS,
  SCHEDULE_PREFERENCE_LABELS,
} from "@/lib/constants";

function generateRef() {
  const year = new Date().getFullYear();
  const num = Math.floor(1000 + Math.random() * 9000);
  return `COM-${year}-${num}`;
}

export default function CommercialConfirmation() {
  const router = useRouter();
  const store = useBookingStore();
  const [quoteRef] = useState(generateRef);

  const {
    facilityType, sqftRange,
    address, city, zip,
    floors, serviceAreas,
    name, businessName, email, phone,
    commercialFrequency, schedulePreference,
    reset, setSubmitting,
  } = store;

  useEffect(() => {
    if (!email || !businessName) router.replace("/commercial");
    setSubmitting(false);
  }, [email, businessName, router, setSubmitting]);

  const areaLabels = serviceAreas
    .map((id) => COMMERCIAL_SERVICE_AREAS.find((a) => a.id === id)?.label ?? id)
    .join(", ");

  return (
    <>
      <CommercialNav />

      <div className="max-w-sm mx-auto md:max-w-3xl px-4 pt-8 pb-12 md:pt-14 md:px-8">
        {/* Success header */}
        <div className="flex flex-col items-center text-center mb-8 md:mb-10">
          <div
            className="w-20 h-20 rounded-full border-2 border-teal-500 flex items-center justify-center mb-4"
            role="img"
            aria-label="Quote request submitted successfully"
          >
            <svg
              className="w-9 h-9 text-teal-600"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900">
            Quote request submitted!
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Reference:{" "}
            <span className="font-medium text-zinc-700">{quoteRef}</span>
          </p>
        </div>

        {/* Commitment card */}
        <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 mb-6">
          <span className="text-teal-600 text-base mt-0.5" aria-hidden="true">
            🕐
          </span>
          <p className="text-sm text-teal-700 font-medium">
            We'll follow up within one business day with a custom quote.
          </p>
        </div>

        {/* Submission summary */}
        <div className="rounded-xl border border-zinc-200 p-4 md:p-5 mb-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">
            Submission Summary
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            {facilityType && (
              <div className="flex gap-3">
                <span className="text-zinc-400 w-28 flex-shrink-0">Facility</span>
                <span className="text-zinc-900 font-medium">
                  {FACILITY_TYPE_LABELS[facilityType]}
                </span>
              </div>
            )}
            {sqftRange && (
              <div className="flex gap-3">
                <span className="text-zinc-400 w-28 flex-shrink-0">Size</span>
                <span className="text-zinc-900 font-medium">
                  {SQFT_DISPLAY[sqftRange]}
                </span>
              </div>
            )}
            {address && (
              <div className="flex gap-3">
                <span className="text-zinc-400 w-28 flex-shrink-0">Address</span>
                <span className="text-zinc-900 font-medium">
                  {address}, {city} {zip}
                </span>
              </div>
            )}
            <div className="flex gap-3">
              <span className="text-zinc-400 w-28 flex-shrink-0">Floors</span>
              <span className="text-zinc-900 font-medium">{floors}</span>
            </div>
            {areaLabels && (
              <div className="flex gap-3">
                <span className="text-zinc-400 w-28 flex-shrink-0">Areas</span>
                <span className="text-zinc-900 font-medium">{areaLabels}</span>
              </div>
            )}
            <div className="border-t border-zinc-100 my-1" />
            <div className="flex gap-3">
              <span className="text-zinc-400 w-28 flex-shrink-0">Contact</span>
              <span className="text-zinc-900 font-medium">{name}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-zinc-400 w-28 flex-shrink-0">Business</span>
              <span className="text-zinc-900 font-medium">{businessName}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-zinc-400 w-28 flex-shrink-0">Email</span>
              <span className="text-zinc-900 font-medium">{email}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-zinc-400 w-28 flex-shrink-0">Phone</span>
              <span className="text-zinc-900 font-medium">{phone}</span>
            </div>
            {commercialFrequency && (
              <div className="flex gap-3">
                <span className="text-zinc-400 w-28 flex-shrink-0">Frequency</span>
                <span className="text-zinc-900 font-medium">
                  {COMMERCIAL_FREQUENCY_LABELS[commercialFrequency]}
                </span>
              </div>
            )}
            {schedulePreference && (
              <div className="flex gap-3">
                <span className="text-zinc-400 w-28 flex-shrink-0">Preference</span>
                <span className="text-zinc-900 font-medium">
                  {SCHEDULE_PREFERENCE_LABELS[schedulePreference]}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* What happens next */}
        <div className="rounded-xl border border-zinc-200 p-4 md:p-5 mb-8">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">
            What happens next?
          </h2>
          <ol className="flex flex-col gap-3">
            {[
              "Our commercial team reviews your request and facility details.",
              "A specialist contacts you to clarify any questions and finalize scope.",
              "You receive a custom quote — no commitment required.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-zinc-600">
                <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-semibold flex-shrink-0 flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Need help? — mobile only */}
        <div className="md:hidden flex items-start gap-3 rounded-xl border border-zinc-200 p-4 mb-6">
          <span className="text-zinc-400 text-base mt-0.5" aria-hidden="true">
            📞
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-900">
              Need to talk to someone now?
            </p>
            <p className="text-sm text-zinc-500 mt-0.5">
              Call us at{" "}
              <a
                href="tel:+13155550100"
                className="text-teal-600 font-medium hover:text-teal-700"
              >
                (315) 555-0100
              </a>
            </p>
          </div>
        </div>

        {/* Return to Homepage */}
        <Button
          variant="outline"
          className="w-full md:w-auto md:px-8 h-14 text-base font-medium"
          onClick={() => {
            reset();
            router.push("/");
          }}
        >
          ← Return to Homepage
        </Button>
      </div>
    </>
  );
}
