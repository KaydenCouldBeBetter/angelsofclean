"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import WhenHydrated from "@/components/booking/WhenHydrated";
import { useBookingStore } from "@/store/bookingStore";
import { BATHROOM_LIMITS, FIELD_MAX_LENGTHS } from "@/lib/constants";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  // Bathrooms move in half steps (1, 1.5, 2 …); bedrooms in whole ones.
  step?: number;
  // Singular and plural noun, spoken after the value: "1.5 bathrooms".
  units: [one: string, other: string];
  onChange: (value: number) => void;
}

function Stepper({ label, value, min, max, step = 1, units, onChange }: StepperProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label id={`${label}-label`}>{label}</Label>
      <div className="flex items-center border-2 border-zinc-200 rounded-xl overflow-hidden h-14" role="group" aria-labelledby={`${label}-label`}>
        <button
          onClick={() => onChange(value - step)}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="w-14 h-full flex items-center justify-center text-xl font-semibold text-primary disabled:text-zinc-300 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors"
        >
          −
        </button>
        <span className="flex-1 text-center text-xl font-bold text-zinc-900" aria-live="polite">
          {value}
          <span className="sr-only"> {value === 1 ? units[0] : units[1]}</span>
        </span>
        <button
          onClick={() => onChange(value + step)}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="w-14 h-full flex items-center justify-center text-xl font-semibold text-primary disabled:text-zinc-300 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

function PropertyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const store = useBookingStore();
  const { setStep3 } = store;

  useEffect(() => {
    if (!store.address) router.replace("/residential");
  }, [store.address, router]);

  const [bedrooms, setBedrooms] = useState(store.bedrooms);
  const [bathrooms, setBathrooms] = useState(store.bathrooms);
  const [notes, setNotes] = useState(store.notes);
  const [accessInstructions, setAccessInstructions] = useState(store.accessInstructions);

  function handleNext() {
    setStep3(bedrooms, bathrooms, notes, accessInstructions);
    router.push(returnTo === "review" ? "/residential/review" : "/residential/datetime");
  }

  return (
    <>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <StepHeader step={3} totalSteps={6} backHref="/residential/address" />
        <ProgressDots currentStep={3} totalSteps={6} />
      </div>

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32 lg:px-0 lg:pb-0">
        <h1 className="text-2xl font-bold leading-tight lg:text-3xl">
          Tell us about your property
        </h1>

        {/* Steppers — stacked on mobile, side by side on desktop */}
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
          <div className="lg:flex-1">
            <Stepper
              label="Bedrooms"
              value={bedrooms}
              min={1}
              max={5}
              units={["bedroom", "bedrooms"]}
              onChange={setBedrooms}
            />
          </div>
          <div className="lg:flex-1">
            <Stepper
              label="Bathrooms"
              value={bathrooms}
              min={BATHROOM_LIMITS.min}
              max={BATHROOM_LIMITS.max}
              step={BATHROOM_LIMITS.step}
              units={["bathroom", "bathrooms"]}
              onChange={setBathrooms}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Special instructions (optional)</Label>
          <Textarea
            id="notes"
            placeholder="E.g., skip the basement, use unscented products..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={FIELD_MAX_LENGTHS.notes}
            className="min-h-24 resize-none"
          />
        </div>

        {/* Stored apart from the notes (booking_access) and seen only by
            admins, so door codes stay out of lists, the calendar and logs. */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="access-instructions">
            Entry instructions (optional)
          </Label>
          <p id="access-instructions-hint" className="text-sm text-zinc-600">
            Door code, gate, pets. Kept separate from your other booking details and seen only by
            our office staff.
          </p>
          <Textarea
            id="access-instructions"
            aria-describedby="access-instructions-hint"
            placeholder="E.g., side gate code 4412, the cat stays inside"
            value={accessInstructions}
            onChange={(e) => setAccessInstructions(e.target.value)}
            maxLength={FIELD_MAX_LENGTHS.accessInstructions}
            autoComplete="off"
            spellCheck={false}
            className="min-h-20 resize-none"
          />
        </div>

        {/* Desktop inline CTA */}
        <div className="hidden lg:block mt-2">
          <button
            onClick={handleNext}
            className="w-[360px] h-14 rounded-xl bg-primary text-white text-base font-semibold hover:bg-primary-pressed transition-colors"
          >
            {returnTo === "review" ? "Save & Return to Review" : "Next \u2192"}
          </button>
          <div className="mt-3">
            <Link href="/residential/address" className="text-sm font-medium text-primary hover:underline">
              &larr; Back
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

export default function PropertyPage() {
  return (
    <WhenHydrated>
      <PropertyPageContent />
    </WhenHydrated>
  );
}
