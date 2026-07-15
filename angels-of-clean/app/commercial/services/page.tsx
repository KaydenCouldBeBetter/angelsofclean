"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import CommercialNav from "@/components/booking/CommercialNav";
import CommercialStepper from "@/components/booking/CommercialStepper";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBookingStore } from "@/store/bookingStore";
import { COMMERCIAL_SERVICE_AREAS } from "@/lib/constants";

export default function CommercialStep2() {
  const router = useRouter();
  const store = useBookingStore();

  useEffect(() => {
    if (!store.facilityType) router.replace("/commercial");
  }, [store.facilityType, router]);

  const [floors, setFloors] = useState(store.floors ?? 1);
  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    store.serviceAreas ?? []
  );
  const [notes, setNotes] = useState(store.commercialNotes || "");

  const isValid = selectedAreas.length > 0;

  function toggleArea(id: string) {
    setSelectedAreas((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function handleNext() {
    if (!isValid) return;
    store.setCommercialStep2(floors, selectedAreas, notes);
    router.push("/commercial/contact");
  }

  return (
    <>
      {/* Desktop */}
      <CommercialNav />
      <CommercialStepper currentStep={2} />

      {/* Mobile header */}
      <div className="md:hidden">
        <StepHeader step={2} totalSteps={4} backHref="/commercial" />
        <ProgressDots currentStep={2} totalSteps={4} />
      </div>

      {/* Content */}
      <div className="max-w-sm mx-auto md:max-w-3xl px-4 pt-6 pb-32 md:pb-12 md:pt-10 md:px-8">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 leading-tight">
          Define the scope of service
        </h1>
        <p className="text-sm text-zinc-500 mt-1 mb-6 md:mb-8">
          Help us understand the size and specific needs of your facility.
        </p>

        {/* Floors stepper */}
        <div className="mb-6 md:mb-8">
          <Label className="text-sm font-semibold text-zinc-900 mb-3 block">
            Number of Floors
          </Label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setFloors((f) => Math.max(1, f - 1))}
              aria-label="Decrease floors"
              disabled={floors <= 1}
              className="w-12 h-12 rounded-xl border-2 border-zinc-200 text-zinc-700 text-xl font-semibold hover:border-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              −
            </button>
            <span className="text-2xl font-semibold text-zinc-900 w-8 text-center" aria-live="polite">
              {floors}
            </span>
            <button
              type="button"
              onClick={() => setFloors((f) => Math.min(20, f + 1))}
              aria-label="Increase floors"
              disabled={floors >= 20}
              className="w-12 h-12 rounded-xl border-2 border-zinc-200 text-zinc-700 text-xl font-semibold hover:border-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Select the number of floors that require cleaning service.
          </p>
        </div>

        {/* Service Areas */}
        <div className="mb-6 md:mb-8">
          <Label className="text-sm font-semibold text-zinc-900 mb-1 block">
            Areas Requiring Attention
          </Label>
          <p className="text-xs text-zinc-500 mb-3">
            Select all areas that need regular cleaning.
          </p>
          <div
            role="group"
            aria-label="Areas requiring attention"
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {COMMERCIAL_SERVICE_AREAS.map((area) => {
              const isChecked = selectedAreas.includes(area.id);
              return (
                <label
                  key={area.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    isChecked
                      ? "border-teal-600 bg-teal-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <div
                    role="checkbox"
                    aria-checked={isChecked}
                    className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                      isChecked
                        ? "bg-teal-600 border-teal-600"
                        : "border-zinc-300 bg-white"
                    }`}
                  >
                    {isChecked && (
                      <svg
                        className="w-3 h-3 text-white"
                        viewBox="0 0 12 10"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M1 5l3.5 3.5L11 1"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleArea(area.id)}
                    className="sr-only"
                    aria-label={area.label}
                  />
                  <span
                    className={`text-sm font-medium ${
                      isChecked ? "text-teal-700" : "text-zinc-700"
                    }`}
                  >
                    {area.label}
                  </span>
                </label>
              );
            })}
          </div>
          {selectedAreas.length === 0 && (
            <p className="text-xs text-zinc-400 mt-2">
              Select at least one area to continue.
            </p>
          )}
        </div>

        {/* Special requirements */}
        <div className="mb-6 md:mb-8">
          <Label htmlFor="notes" className="text-sm font-semibold text-zinc-900 mb-1 block">
            Special Requirements or Notes{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            placeholder="e.g., High-traffic areas, specialized equipment needed, restricted access hours, hazardous materials…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-28 resize-none"
          />
          <p className="text-xs text-zinc-400 mt-1.5">
            Optional — include any details that would help us prepare an accurate quote.
          </p>
        </div>

        {/* Desktop Next + Back */}
        <div className="hidden md:flex md:flex-col md:gap-4">
          <Button
            onClick={handleNext}
            disabled={!isValid}
            className="w-64 h-14 text-base font-semibold"
          >
            Next →
          </Button>
          <Link
            href="/commercial"
            className="text-sm text-teal-700 hover:text-teal-800 transition-colors"
          >
            ← Back to Facility Info
          </Link>
        </div>
      </div>

      {/* Mobile bottom CTA */}
      <div className="md:hidden">
        <BottomCTA label="Next" onClick={handleNext} disabled={!isValid} />
      </div>
    </>
  );
}
