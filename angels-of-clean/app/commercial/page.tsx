"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";

const FACILITY_TYPES = [
  { id: "office" as const, name: "Office", description: "Professional office space" },
  { id: "retail" as const, name: "Retail", description: "Storefronts and showrooms" },
  { id: "medical" as const, name: "Medical", description: "Clinics and healthcare facilities" },
  { id: "warehouse/shop" as const, name: "Warehouse / Shop", description: "Industrial and storage spaces" },
  { id: "other" as const, name: "Other", description: "Contact us to discuss your needs" },
];

export default function CommercialPage() {
  const router = useRouter();
  const store = useBookingStore();
  const { setCommercialStep1 } = store;

  const [selectedFacility, setSelectedFacility] = useState(store.facilityType ?? "office");

  function handleNext() {
    setCommercialStep1(selectedFacility);
    router.push("/commercial/address");
  }

  return (
    <>
      <StepHeader step={1} totalSteps={5} backHref="/" />
      <ProgressDots currentStep={1} totalSteps={5} />

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32">
        <h1 className="text-2xl font-bold leading-tight">
          What type of facility needs cleaning?
        </h1>

        <div role="radiogroup" aria-label="Facility type" className="flex flex-col gap-3">
          {FACILITY_TYPES.map((facility) => {
            const isSelected = selectedFacility === facility.id;
            return (
              <button
                key={facility.id}
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedFacility(facility.id)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
                  isSelected
                    ? "border-teal-600 bg-teal-50"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <span className="text-teal-600 text-sm font-semibold" aria-hidden="true">✓</span>
                  )}
                  <span className={`font-semibold ${isSelected ? "text-teal-700" : "text-zinc-900"}`}>
                    {facility.name}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-1">{facility.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <BottomCTA label="Next" onClick={handleNext} />
    </>
  );
}
