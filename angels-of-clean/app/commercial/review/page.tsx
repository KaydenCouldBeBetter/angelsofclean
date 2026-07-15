"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import CommercialNav from "@/components/booking/CommercialNav";
import CommercialStepper from "@/components/booking/CommercialStepper";
import { Button } from "@/components/ui/button";
import { useBookingStore } from "@/store/bookingStore";
import {
  FACILITY_TYPE_LABELS,
  SQFT_DISPLAY,
  COMMERCIAL_SERVICE_AREAS,
  COMMERCIAL_FREQUENCY_LABELS,
  SCHEDULE_PREFERENCE_LABELS,
} from "@/lib/constants";

export default function CommercialReview() {
  const router = useRouter();
  const store = useBookingStore();

  const {
    facilityType, sqftRange,
    address, city, zip,
    floors, serviceAreas, commercialNotes,
    name, businessName, email, phone,
    commercialFrequency, schedulePreference,
    isSubmitting, setSubmitting,
  } = store;

  useEffect(() => {
    if (!facilityType || !name || !businessName) router.replace("/commercial");
  }, [facilityType, name, businessName, router]);

  const areaLabels = serviceAreas
    .map((id) => COMMERCIAL_SERVICE_AREAS.find((a) => a.id === id)?.label ?? id)
    .join(", ");

  function handleSubmit() {
    if (isSubmitting) return;
    setSubmitting(true);
    router.push("/commercial/confirmation");
  }

  return (
    <>
      {/* Desktop */}
      <CommercialNav />
      <CommercialStepper currentStep={4} />

      {/* Mobile header */}
      <div className="md:hidden">
        <StepHeader step={4} totalSteps={4} backHref="/commercial/contact" />
        <ProgressDots currentStep={4} totalSteps={4} />
      </div>

      {/* Content */}
      <div className="max-w-sm mx-auto md:max-w-3xl px-4 pt-6 pb-32 md:pb-12 md:pt-10 md:px-8">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 leading-tight">
          Review your quote request
        </h1>
        <p className="text-sm text-zinc-500 mt-1 mb-6 md:mb-8">
          Please review the details below before submitting.
        </p>

        <div className="flex flex-col gap-3 md:gap-4">
          {/* Facility Info */}
          <div className="rounded-xl border border-zinc-200 p-4 md:p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm font-semibold text-zinc-900">Facility Info</span>
              <Link href="/commercial" className="text-sm text-teal-600 font-medium hover:text-teal-700">
                Edit
              </Link>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex gap-3">
                <span className="text-zinc-400 w-32 flex-shrink-0">Facility Type</span>
                <span className="text-zinc-900 font-medium">
                  {facilityType ? FACILITY_TYPE_LABELS[facilityType] : "—"}
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-32 flex-shrink-0">Square Footage</span>
                <span className="text-zinc-900 font-medium">
                  {sqftRange ? SQFT_DISPLAY[sqftRange] : "—"}
                </span>
              </div>
              {address && (
                <div className="flex gap-3">
                  <span className="text-zinc-400 w-32 flex-shrink-0">Address</span>
                  <span className="text-zinc-900 font-medium">{address}, {city} {zip}</span>
                </div>
              )}
            </div>
          </div>

          {/* Service Scope */}
          <div className="rounded-xl border border-zinc-200 p-4 md:p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm font-semibold text-zinc-900">Service Scope</span>
              <Link href="/commercial/services" className="text-sm text-teal-600 font-medium hover:text-teal-700">
                Edit
              </Link>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex gap-3">
                <span className="text-zinc-400 w-32 flex-shrink-0">Floors</span>
                <span className="text-zinc-900 font-medium">{floors}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-32 flex-shrink-0">Areas</span>
                <span className="text-zinc-900 font-medium">{areaLabels || "—"}</span>
              </div>
              {commercialNotes && (
                <div className="flex gap-3">
                  <span className="text-zinc-400 w-32 flex-shrink-0">Special Notes</span>
                  <span className="text-zinc-900 font-medium">{commercialNotes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact & Frequency */}
          <div className="rounded-xl border border-zinc-200 p-4 md:p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm font-semibold text-zinc-900">Contact &amp; Frequency</span>
              <Link href="/commercial/contact" className="text-sm text-teal-600 font-medium hover:text-teal-700">
                Edit
              </Link>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex gap-3">
                <span className="text-zinc-400 w-32 flex-shrink-0">Contact</span>
                <span className="text-zinc-900 font-medium">{name}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-32 flex-shrink-0">Business</span>
                <span className="text-zinc-900 font-medium">{businessName}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-32 flex-shrink-0">Email</span>
                <span className="text-zinc-900 font-medium">{email}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-32 flex-shrink-0">Phone</span>
                <span className="text-zinc-900 font-medium">{phone}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-32 flex-shrink-0">Frequency</span>
                <span className="text-zinc-900 font-medium">
                  {commercialFrequency ? COMMERCIAL_FREQUENCY_LABELS[commercialFrequency] : "—"}
                </span>
              </div>
              {schedulePreference && (
                <div className="flex gap-3">
                  <span className="text-zinc-400 w-32 flex-shrink-0">Preference</span>
                  <span className="text-zinc-900 font-medium">
                    {SCHEDULE_PREFERENCE_LABELS[schedulePreference]}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Commitment */}
          <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4">
            <span className="text-teal-600 text-base mt-0.5" aria-hidden="true">🕐</span>
            <p className="text-sm text-teal-700 font-medium">
              We respond to every quote request within one business day.
            </p>
          </div>
        </div>

        {/* Desktop Submit + Back */}
        <div className="hidden md:flex md:flex-col md:gap-4 mt-8">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-14 text-base font-semibold"
          >
            {isSubmitting ? "Submitting…" : "Submit Quote Request →"}
          </Button>
          <Link
            href="/commercial/contact"
            className="text-sm text-teal-700 hover:text-teal-800 transition-colors"
          >
            ← Back to Contact &amp; Frequency
          </Link>
        </div>
      </div>

      {/* Mobile bottom CTA */}
      <div className="md:hidden">
        <BottomCTA
          label={isSubmitting ? "Submitting…" : "Submit Quote Request"}
          onClick={handleSubmit}
          disabled={isSubmitting}
        />
      </div>
    </>
  );
}
