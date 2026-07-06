"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FREQUENCIES = [
  { id: "one-time" as const, label: "One-time" },
  { id: "weekly" as const, label: "Weekly" },
  { id: "bi-weekly" as const, label: "Bi-weekly" },
  { id: "monthly" as const, label: "Monthly" },
];

export default function DetailsPage() {
  const router = useRouter();
  const store = useBookingStore();
  const { setCommercialStep3 } = store;

  useEffect(() => {
    if (!store.facilityType) router.replace("/commercial");
  }, [store.facilityType, router]);

  const [businessName, setBusinessName] = useState(store.businessName || "");
  const [selectedFrequency, setSelectedFrequency] = useState(store.frequency ?? "weekly");
  const [notes, setNotes] = useState(store.notes || "");

  const isValid = businessName.trim() !== "";

  function handleNext() {
    setCommercialStep3(businessName, selectedFrequency, notes);
    router.push("/commercial/contact");
  }

  return (
    <>
      <StepHeader step={3} totalSteps={5} backHref="/commercial/address" />
      <ProgressDots currentStep={3} totalSteps={5} />

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32">
        <h1 className="text-2xl font-bold leading-tight">
          Tell us about your business
        </h1>

        {/* Business name */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="businessName">Business Name</Label>
          <Input
            id="businessName"
            placeholder="Enter your business name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="h-14"
          />
        </div>

        {/* Frequency */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">How often do you need cleaning?</h2>
          <div role="radiogroup" aria-label="Cleaning frequency" className="flex flex-col gap-2">
            {FREQUENCIES.map((freq) => {
              const isSelected = selectedFrequency === freq.id;
              return (
                <button
                  key={freq.id}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelectedFrequency(freq.id)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-4 transition-colors flex items-center justify-between ${
                    isSelected
                      ? "border-teal-600 bg-teal-50 text-teal-700"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <span className="font-medium">{freq.label}</span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">
            Special Requirements{" "}
            <span className="text-zinc-400 font-normal">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            placeholder="Any specific cleaning needs, access instructions, or special requests..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-24 resize-none"
          />
        </div>
      </div>

      <BottomCTA label="Next" onClick={handleNext} disabled={!isValid} />
    </>
  );
}
