"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { TIME_SLOT_WINDOWS } from "@/lib/constants";
import { addDaysToDateStr, isNyWallClockInFuture, nyTodayStr } from "@/lib/datetime";

const TIME_SLOTS = [
  { id: "morning" as const, label: TIME_SLOT_WINDOWS.morning.label, sub: TIME_SLOT_WINDOWS.morning.display },
  { id: "afternoon" as const, label: TIME_SLOT_WINDOWS.afternoon.label, sub: TIME_SLOT_WINDOWS.afternoon.display },
  { id: "evening" as const, label: "Evening", sub: "Unavailable", disabled: true },
];

const BOOKABLE_SLOTS = ["morning", "afternoon"] as const;

// A slot on a given date is only offerable if its start is still in the future
// in New York — this enforces the same-day cutoff (and never offers a past day).
function isSlotBookable(dateStr: string, slotId: "morning" | "afternoon") {
  return isNyWallClockInFuture(dateStr, TIME_SLOT_WINDOWS[slotId].start);
}

// The earliest slot still bookable on a date (getWeekDays only offers days that
// have at least one, so this is always defined for an offered date).
function firstBookableSlot(dateStr: string): "morning" | "afternoon" {
  return BOOKABLE_SLOTS.find((slot) => isSlotBookable(dateStr, slot)) ?? "morning";
}

function getWeekDays() {
  const days = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // "Today" is New York's today, not the browser's, so the offered dates match
  // the business calendar for a customer booking from another timezone. If every
  // slot today has already passed, start from tomorrow.
  const todayStr = nyTodayStr();
  const todayHasSlot = BOOKABLE_SLOTS.some((slot) => isSlotBookable(todayStr, slot));
  let cursor = todayHasSlot ? todayStr : addDaysToDateStr(todayStr, 1);

  for (let i = 0; i < 6; i++) {
    // cursor is a NY calendar date; read its weekday/day-of-month in UTC so the
    // labels don't drift with the browser zone.
    const [y, m, d] = cursor.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    days.push({
      label: dayNames[dt.getUTCDay()],
      date: dt.getUTCDate(),
      full: cursor,
      isFull: i === 2, // 3rd day marked as "Full" per Figma (real availability is B10)
    });
    cursor = addDaysToDateStr(cursor, 1);
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
  // Only trust a stored date if it's still one of the offered (future) days —
  // a stale sessionStorage date could otherwise carry a now-past day forward.
  const storedDateOffered = days.some((day) => day.full === store.date && !day.isFull);
  const initialDate = storedDateOffered ? store.date : days[1].full;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  // Clamp the initial slot to one still bookable for the initial date (the
  // stored slot could be this morning's, already past).
  const initialSlot = store.timeSlot ?? "morning";
  const [selectedSlot, setSelectedSlot] = useState<"morning" | "afternoon">(
    isSlotBookable(initialDate, initialSlot) ? initialSlot : firstBookableSlot(initialDate),
  );

  // Picking a date can invalidate the current slot (today after its start), so
  // switch to the first still-bookable slot here rather than in an effect.
  function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr);
    if (!isSlotBookable(dateStr, selectedSlot)) {
      setSelectedSlot(firstBookableSlot(dateStr));
    }
  }

  function handleNext() {
    setStep4(selectedDate, selectedSlot);
    router.push(returnTo === "review" ? "/residential/review" : "/residential/contact");
  }

  // Get current month/year for header
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <StepHeader step={4} totalSteps={6} backHref="/residential/property" />
        <ProgressDots currentStep={4} totalSteps={6} />
      </div>

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32 lg:px-0 lg:pb-0">
        <h1 className="text-2xl font-bold leading-tight lg:text-3xl">
          When would you like us to come?
        </h1>

        {/* Month navigation */}
        <div className="hidden lg:flex items-center gap-2 text-sm font-medium text-zinc-700">
          <button className="text-[#1a6b5a] hover:underline">&larr;</button>
          <span>{monthLabel}</span>
          <button className="text-[#1a6b5a] hover:underline">&rarr;</button>
        </div>

        {/* Date chips — mobile: horizontal scroll, desktop: 3-col grid */}
        <div
          role="radiogroup"
          aria-label="Select a date"
          className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0 lg:gap-3"
        >
          {days.map((day) => {
            const isSelected = selectedDate === day.full;
            const isDisabled = day.isFull;
            return (
              <button
                key={day.full}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${day.label} the ${day.date}`}
                disabled={isDisabled}
                onClick={() => !isDisabled && handleSelectDate(day.full)}
                className={`flex flex-col items-center justify-center min-w-[52px] h-16 lg:h-[72px] rounded-xl border-2 text-sm font-medium transition-colors flex-shrink-0 ${
                  isDisabled
                    ? "border-zinc-100 bg-zinc-50 text-zinc-400 cursor-not-allowed"
                    : isSelected
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs">{day.label}</span>
                <span className="text-lg font-bold">{day.date}</span>
                {isDisabled && <span className="text-[10px]">Full</span>}
              </button>
            );
          })}
        </div>

        {/* Time slots */}
        <div className="flex flex-col gap-3">
          <h2 id="time-slot-label" className="text-base font-semibold text-zinc-900">
            Preferred Time
          </h2>

          {/* Mobile: stacked, Desktop: row */}
          <div
            role="radiogroup"
            aria-labelledby="time-slot-label"
            className="flex flex-col gap-3 lg:flex-row"
          >
            {TIME_SLOTS.map((slot) => {
              // Evening is always disabled; morning/afternoon are disabled when
              // their start has already passed for the selected date (cutoff).
              const cutoffPassed =
                slot.id !== "evening" &&
                !isSlotBookable(selectedDate, slot.id as "morning" | "afternoon");
              const disabled = slot.disabled || cutoffPassed;
              const isSelected = selectedSlot === slot.id && !disabled;
              const sub = cutoffPassed ? "Unavailable" : slot.sub;
              return (
                <button
                  key={slot.id}
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={disabled}
                  onClick={() => !disabled && setSelectedSlot(slot.id as "morning" | "afternoon")}
                  disabled={disabled}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-colors lg:flex-1 lg:text-center ${
                    disabled
                      ? "border-zinc-100 bg-zinc-50 cursor-not-allowed"
                      : isSelected
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <span className={`font-semibold ${disabled ? "text-zinc-400" : isSelected ? "text-white" : "text-zinc-900"}`}>
                    {slot.label}
                  </span>
                  <p className={`text-xs mt-1 ${disabled ? "text-zinc-400" : isSelected ? "text-white/80" : "text-zinc-500"}`}>
                    {sub}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop inline CTA */}
        <div className="hidden lg:block mt-2">
          <button
            onClick={handleNext}
            className="w-[360px] h-14 rounded-xl bg-[#1a6b5a] text-white text-base font-semibold hover:bg-[#155a4b] transition-colors"
          >
            {returnTo === "review" ? "Save & Return to Review" : "Next \u2192"}
          </button>
          <div className="mt-3">
            <Link href="/residential/property" className="text-sm font-medium text-[#1a6b5a] hover:underline">
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
