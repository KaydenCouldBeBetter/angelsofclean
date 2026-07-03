"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function Stepper({ label, value, min, max, onChange }: StepperProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center border-2 border-zinc-200 rounded-xl overflow-hidden h-14">
        <button
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="w-14 h-full flex items-center justify-center text-xl font-semibold text-teal-600 disabled:text-zinc-300 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors"
        >
          −
        </button>
        <span className="flex-1 text-center text-xl font-bold text-zinc-900">
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="w-14 h-full flex items-center justify-center text-xl font-semibold text-teal-600 disabled:text-zinc-300 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function PropertyPage() {
  const router = useRouter();
  const { setStep3 } = useBookingStore();

  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [notes, setNotes] = useState("");

  function handleNext() {
    setStep3(bedrooms, bathrooms, notes);
    router.push("/residential/datetime");
  }

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-sm mx-auto">
      <StepHeader step={3} totalSteps={6} backHref="/residential/address" />
      <ProgressDots currentStep={3} totalSteps={6} />

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32">
        <h1 className="text-2xl font-bold leading-tight">
          Tell us about your home
        </h1>

        <Stepper
          label="Bedrooms"
          value={bedrooms}
          min={1}
          max={5}
          onChange={setBedrooms}
        />

        <Stepper
          label="Bathrooms"
          value={bathrooms}
          min={1}
          max={5}
          onChange={setBathrooms}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Special Instructions (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="e.g. small dogs in the house, please use unscented products, or skip the basement"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-24 resize-none"
          />
        </div>
      </div>

      <BottomCTA label="Next" onClick={handleNext} />
    </div>
  );
}
