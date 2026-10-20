"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import Selectable, { SelectableGroup } from "@/components/booking/Selectable";
import WhenHydrated from "@/components/booking/WhenHydrated";
import { useBookingStore } from "@/store/bookingStore";
import { FREQUENCY_OPTIONS, PRICE_NOTE, SERVICE_DESCRIPTIONS, SERVICE_LABELS } from "@/lib/constants";

// Names and descriptions come from lib/constants.ts; only the short mobile
// blurb is specific to this card.
const SERVICES = [
  { id: "standard" as const, shortDesc: "Regular maintenance cleaning" },
  { id: "deep" as const, shortDesc: "Thorough top-to-bottom cleaning" },
  { id: "moveinout" as const, shortDesc: "Full property reset" },
];

function ResidentialPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const store = useBookingStore();
  const { setStep1 } = store;

  const [selectedService, setSelectedService] = useState<"standard" | "deep" | "moveinout">(store.service ?? "standard");
  const [selectedFrequency, setSelectedFrequency] = useState<"one-time" | "weekly" | "bi-weekly" | "monthly">(store.frequency ?? "one-time");

  function handleNext() {
    setStep1(selectedService, selectedFrequency);
    router.push(returnTo === "review" ? "/residential/review" : "/residential/address");
  }

  return (
    <>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <StepHeader step={1} totalSteps={6} backHref="/" />
        <ProgressDots currentStep={1} totalSteps={6} />
      </div>

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32 lg:px-0 lg:pb-0">
        <h1 className="text-2xl font-bold leading-tight lg:text-3xl">
          What type of cleaning do you need?
        </h1>

        {/* Service Cards — mobile: stacked, desktop: horizontal row */}
        <SelectableGroup
          type="radio"
          aria-label="Service type"
          className="flex flex-col gap-3 lg:flex-row"
        >
          {SERVICES.map((service) => (
            <Selectable
              key={service.id}
              value={service.id}
              selected={selectedService === service.id}
              onSelect={() => setSelectedService(service.id)}
              className="block w-full p-4 pr-10 text-left lg:flex lg:flex-1 lg:flex-col lg:justify-between lg:min-h-[200px]"
            >
              <span className="block">
                <span className="flex items-center justify-between lg:block">
                  <span className="text-base font-semibold text-zinc-900 group-data-selected:text-white">
                    {SERVICE_LABELS[service.id]}
                  </span>
                </span>
                {/* Mobile: short description */}
                <span className="block text-sm font-normal text-zinc-500 group-data-selected:text-white mt-1 lg:hidden">
                  {service.shortDesc}
                </span>
                {/* Desktop: full description */}
                <span className="hidden lg:block text-sm font-normal text-zinc-500 group-data-selected:text-white mt-2">
                  {SERVICE_DESCRIPTIONS[service.id]}
                </span>
              </span>
            </Selectable>
          ))}
        </SelectableGroup>

        <p className="text-sm text-zinc-500">{PRICE_NOTE}</p>

        {/* Frequency */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">How often?</h2>
          <SelectableGroup
            type="radio"
            aria-label="Cleaning frequency"
            className="flex gap-2 flex-wrap"
          >
            {FREQUENCY_OPTIONS.map((freq) => (
              <Selectable
                key={freq.id}
                value={freq.id}
                selected={selectedFrequency === freq.id}
                onSelect={() => setSelectedFrequency(freq.id)}
                className="flex min-h-11 items-center justify-center px-6 py-2 lg:py-2.5"
              >
                {freq.label}
              </Selectable>
            ))}
          </SelectableGroup>
        </div>

        {/* Desktop inline CTA */}
        <div className="hidden lg:block mt-4">
          <button
            onClick={handleNext}
            className="w-[360px] h-14 rounded-xl bg-primary text-white text-base font-semibold hover:bg-primary-pressed transition-colors"
          >
            {returnTo === "review" ? "Save & Return to Review" : "Next \u2192"}
          </button>
          <div className="mt-3">
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile fixed CTA */}
      <div className="lg:hidden">
        <BottomCTA label={returnTo === "review" ? "Save & Return to Review" : "Next"} onClick={handleNext} />
      </div>
    </>
  );
}

export default function ResidentialPage() {
  return (
    <WhenHydrated>
      <ResidentialPageContent />
    </WhenHydrated>
  );
}
