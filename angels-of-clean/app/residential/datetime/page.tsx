"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";

const TIME_SLOTS = [
  { id: "morning" as const, label: "Morning (8am–12pm)", note: "Most popular" },
  { id: "afternoon" as const, label: "Afternoon (12pm–4pm)", note: null },
  { id: "evening" as const, label: "Evening (4pm–7pm)", note: "Unavailable", disabled: true },
];

function getWeekDays() {
  const days = [];
  const today = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 6; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      label: dayNames[date.getDay()],
      date: date.getDate(),
      full: date.toISOString().split("T")[0],
    });
  }
  return days;
}

export default function DateTimePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const store = useBookingStore();
  const { setStep4 } = store;

  useEffect(() => {
    if (!store.address) router.replace("/residential");
  }, [store.address, router]);

  const days = getWeekDays();
  const [selectedDate, setSelectedDate] = useState(store.date || days[0].full);
  const [selectedSlot, setSelectedSlot] = useState<"morning" | "afternoon">(store.timeSlot ?? "morning");

  function handleNext() {
    setStep4(selectedDate, selectedSlot);
    router.push(returnTo === "review" ? "/residential/review" : "/residential/contact");
  }

  return (
    <>
      <StepHeader step={4} totalSteps={6} backHref="/residential/property" />
      <ProgressDots currentStep={4} totalSteps={6} />

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32">
        <h1 className="text-2xl font-bold leading-tight">
          When would you like us to come?
        </h1>

        {/* Date chips */}
        <div role="radiogroup" aria-label="Select a date" className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const isSelected = selectedDate === day.full;
            return (
              <button
                key={day.full}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${day.label} the ${day.date}`}
                onClick={() => setSelectedDate(day.full)}
                className={`flex flex-col items-center justify-center min-w-[52px] h-16 rounded-xl border-2 text-sm font-medium transition-colors flex-shrink-0 ${
                  isSelected
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs">{day.label}</span>
                <span className="text-lg font-bold">{day.date}</span>
              </button>
            );
          })}
        </div>

        {/* Time slots */}
        <div className="flex flex-col gap-3">
          <h2 id="time-slot-label" className="text-base font-semibold text-zinc-900">Select a time</h2>
          <div role="radiogroup" aria-labelledby="time-slot-label" className="flex flex-col gap-3">
            {TIME_SLOTS.map((slot) => {
              const isSelected = selectedSlot === slot.id && !slot.disabled;
              return (
                <button
                  key={slot.id}
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={slot.disabled}
                  onClick={() => !slot.disabled && setSelectedSlot(slot.id as "morning" | "afternoon")}
                  disabled={slot.disabled}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
                    slot.disabled
                      ? "border-zinc-100 bg-zinc-50 cursor-not-allowed"
                      : isSelected
                      ? "border-teal-600 bg-white"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <span className="text-teal-600 text-sm font-semibold" aria-hidden="true">✓</span>
                    )}
                    <span className={`font-semibold ${slot.disabled ? "text-zinc-400" : "text-zinc-900"}`}>
                      {slot.label}
                    </span>
                  </div>
                  {slot.note && (
                    <p className={`text-xs mt-1 ${slot.disabled ? "text-zinc-400" : "text-zinc-500"}`}>
                      {slot.note}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <BottomCTA label={returnTo === "review" ? "Save & Return to Review" : "Next"} onClick={handleNext} />
    </>
  );
}
