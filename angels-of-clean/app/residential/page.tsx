"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";

const SERVICES = [
  {
    id: "standard" as const,
    name: "Standard Clean",
    description: "Regular maintenance cleaning for your home. Includes dusting, vacuuming, mopping, and surface sanitizing.",
    shortDesc: "Regular maintenance cleaning",
    price: "From $120",
  },
  {
    id: "deep" as const,
    name: "Deep Clean",
    description: "Thorough top-to-bottom cleaning. Includes baseboards, inside appliances, and detailed scrubbing.",
    shortDesc: "Thorough top-to-bottom cleaning",
    price: "From $200",
  },
  {
    id: "moveinout" as const,
    name: "Move-In / Move-Out",
    description: "Complete property turnover clean. Every surface, every room, move-in ready.",
    shortDesc: "Full property reset",
    price: "From $250",
  },
];

const FREQUENCIES = [
  { id: "one-time" as const, label: "One-time" },
  { id: "weekly" as const, label: "Weekly" },
  { id: "bi-weekly" as const, label: "Bi-weekly" },
  { id: "monthly" as const, label: "Monthly" },
];

export default function ResidentialPage() {
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
        <div role="radiogroup" aria-label="Service type" className="flex flex-col gap-3 lg:flex-row">
          {SERVICES.map((service) => {
            const isSelected = selectedService === service.id;
            return (
              <button
                key={service.id}
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedService(service.id)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-colors lg:flex-1 lg:flex lg:flex-col lg:justify-between lg:min-h-[200px] ${
                  isSelected
                    ? "border-teal-600 bg-teal-50"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between lg:block">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="text-teal-600 text-sm font-semibold lg:hidden" aria-hidden="true">&#10003;</span>
                      )}
                      <span className={`font-semibold ${isSelected ? "text-teal-700" : "text-zinc-900"}`}>
                        {service.name}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold lg:hidden ${isSelected ? "text-teal-600" : "text-zinc-500"}`}>
                      {service.price}
                    </span>
                  </div>
                  {/* Mobile: short description */}
                  <p className="text-sm text-zinc-500 mt-1 lg:hidden">{service.shortDesc}</p>
                  {/* Desktop: full description */}
                  <p className="hidden lg:block text-sm text-zinc-500 mt-2">{service.description}</p>
                </div>
                {/* Desktop: price at bottom */}
                <p className={`hidden lg:block text-sm font-semibold mt-4 ${isSelected ? "text-teal-600" : "text-zinc-500"}`}>
                  {service.price}
                </p>
              </button>
            );
          })}
        </div>

        {/* Frequency */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">How often?</h2>
          <div role="radiogroup" aria-label="Cleaning frequency" className="flex gap-2 flex-wrap">
            {FREQUENCIES.map((freq) => {
              const isSelected = selectedFrequency === freq.id;
              return (
                <button
                  key={freq.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedFrequency(freq.id)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors lg:px-6 lg:py-2.5 ${
                    isSelected
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  {freq.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop inline CTA */}
        <div className="hidden lg:block mt-4">
          <button
            onClick={handleNext}
            className="w-[360px] h-14 rounded-xl bg-[#1a6b5a] text-white text-base font-semibold hover:bg-[#155a4b] transition-colors"
          >
            {returnTo === "review" ? "Save & Return to Review" : "Next \u2192"}
          </button>
          <div className="mt-3">
            <Link href="/" className="text-sm font-medium text-[#1a6b5a] hover:underline">
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
