"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";

const SERVICES = [
  {
    id: "standard" as const,
    name: "Standard Clean",
    description: "Regular maintenance cleaning",
    price: "From $85",
  },
  {
    id: "deep" as const,
    name: "Deep Clean",
    description: "Thorough top-to-bottom cleaning",
    price: "From $149",
  },
  {
    id: "moveinout" as const,
    name: "Move-In / Move-Out",
    description: "Full property reset",
    price: "From $199",
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
  const { setStep1 } = useBookingStore();

  const [selectedService, setSelectedService] = useState<"standard" | "deep" | "moveinout">("standard");
  const [selectedFrequency, setSelectedFrequency] = useState<"one-time" | "weekly" | "bi-weekly" | "monthly">("one-time");

  function handleNext() {
    setStep1(selectedService, selectedFrequency);
    router.push("/residential/address");
  }

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-sm mx-auto">
      <StepHeader step={1} totalSteps={6} backHref="/" />
      <ProgressDots currentStep={1} totalSteps={6} />

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32">
        <h1 className="text-2xl font-bold leading-tight">
          What type of cleaning do you need?
        </h1>

        {/* Service Cards */}
        <div className="flex flex-col gap-3">
          {SERVICES.map((service) => {
            const isSelected = selectedService === service.id;
            return (
              <button
                key={service.id}
                onClick={() => setSelectedService(service.id)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
                  isSelected
                    ? "border-teal-600 bg-teal-50"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <span className="text-teal-600 text-sm font-semibold">✓</span>
                    )}
                    <span className={`font-semibold ${isSelected ? "text-teal-700" : "text-zinc-900"}`}>
                      {service.name}
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${isSelected ? "text-teal-600" : "text-zinc-500"}`}>
                    {service.price}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-1 ml-0">{service.description}</p>
              </button>
            );
          })}
        </div>

        {/* Frequency */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">How often?</h2>
          <div className="flex gap-2 flex-wrap">
            {FREQUENCIES.map((freq) => {
              const isSelected = selectedFrequency === freq.id;
              return (
                <button
                  key={freq.id}
                  onClick={() => setSelectedFrequency(freq.id)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
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
      </div>

      <BottomCTA label="Next" onClick={handleNext} />
    </div>
  );
}
