"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const { setStep4 } = useBookingStore();

  const days = getWeekDays();
  const [selectedDate, setSelectedDate] = useState(days[0].full);
  const [selectedSlot, setSelectedSlot] = useState<"morning" | "afternoon">("morning");

  function handleNext() {
    setStep4(selectedDate, selectedSlot);
    router.push("/residential/contact");
  }

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-sm mx-auto">
      <StepHeader step={4} totalSteps={6} backHref="/residential/property" />
      <ProgressDots currentStep={4} totalSteps={6} />

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32">
        <h1 className="text-2xl font-bold leading-tight">
          When would you like us to come?
        </h1>

        {/* Date chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const isSelected = selectedDate === day.full;
            return (
              <button
                key={day.full}
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
          <h2 className="text-base font-semibold text-zinc-900">Select a time</h2>
          {TIME_SLOTS.map((slot) => {
            const isSelected = selectedSlot === slot.id;
            return (
              <button
                key={slot.id}
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
                  {isSelected && !slot.disabled && (
                    <span className="text-teal-600 text-sm font-semibold">✓</span>
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

      <BottomCTA label="Next" onClick={handleNext} />
    </div>
  );
}
