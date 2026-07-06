"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { FACILITY_TYPE_LABELS, FREQUENCY_LABELS, SQFT_RANGE_LABELS } from "@/lib/constants";
import { submitCommercialQuote } from "@/app/actions/submitCommercialQuote";

export default function ReviewPage() {
  const router = useRouter();
  const store = useBookingStore();

  const {
    facilityType, businessName,
    address, city, zip,
    sqftRange, restrooms,
    frequency, notes,
    name, email, phone,
    isSubmitting, setSubmitting,
  } = store;

  useEffect(() => {
    if (!facilityType || !address || !name) router.replace("/commercial");
  }, [facilityType, address, name, router]);

  async function handleSubmit() {
    if (isSubmitting || !facilityType || !sqftRange || !frequency) return;
    setSubmitting(true);

    const result = await submitCommercialQuote({
      facilityType,
      address,
      city,
      zip,
      sqftRange,
      restrooms,
      businessName,
      frequency,
      notes,
      name,
      email,
      phone,
    });

    if (result.success && result.quoteRef) {
      router.push(`/commercial/confirmation?ref=${result.quoteRef}`);
    } else {
      setSubmitting(false);
    }
  }

  return (
    <>
      <StepHeader step={5} totalSteps={5} backHref="/commercial/contact" />
      <ProgressDots currentStep={5} totalSteps={5} />

      <div className="flex flex-col gap-3 px-4 pt-4 pb-32">
        <h1 className="text-2xl font-bold leading-tight mb-2">
          Review your quote request
        </h1>

        {/* Facility */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Facility</span>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">
            {facilityType ? FACILITY_TYPE_LABELS[facilityType] : "—"}
          </p>
          <p className="text-sm text-zinc-500">{businessName || "—"}</p>
        </div>

        {/* Location & Size */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Location & Size</span>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">
            {sqftRange ? SQFT_RANGE_LABELS[sqftRange] : "—"} · {restrooms} restroom{restrooms !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-zinc-500">{address}, {city}, NY {zip}</p>
        </div>

        {/* Service Details */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Service Details</span>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">
            {frequency ? FREQUENCY_LABELS[frequency] : "—"}
          </p>
          {notes && <p className="text-sm text-zinc-500 mt-1">{notes}</p>}
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Contact</span>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">{name}</p>
          <p className="text-sm text-zinc-500">{email}</p>
          <p className="text-sm text-zinc-500">{phone}</p>
        </div>

        {/* Quote info */}
        <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
          <p className="font-semibold text-zinc-900">What happens next?</p>
          <p className="text-sm text-zinc-500 mt-1">
            We'll review your request and send a custom quote to {email} within 1 business day.
          </p>
        </div>
      </div>

      <BottomCTA
        label={isSubmitting ? "Submitting…" : "Request Quote"}
        onClick={handleSubmit}
        disabled={isSubmitting}
      />
    </>
  );
}
