"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import DateExpiredNotice from "@/components/booking/DateExpiredNotice";
import Selectable, { SelectableGroup } from "@/components/booking/Selectable";
import WhenHydrated from "@/components/booking/WhenHydrated";
import { useBookingRules } from "@/components/booking/BookingRulesProvider";
import { useBookingStore } from "@/store/bookingStore";
import { BUSINESS_PHONE, TIME_SLOT_WINDOWS } from "@/lib/constants";
import { checkBookable, type BookingRules } from "@/lib/booking-rules";
import { addDaysToDateStr, formatNy, nyTodayStr } from "@/lib/datetime";

// Evening slot removed per Figma F2 (B34). Only morning and afternoon are offered.
const TIME_SLOTS = [
  { id: "morning" as const, label: TIME_SLOT_WINDOWS.morning.label, sub: TIME_SLOT_WINDOWS.morning.display },
  { id: "afternoon" as const, label: TIME_SLOT_WINDOWS.afternoon.label, sub: TIME_SLOT_WINDOWS.afternoon.display },
];

type SlotId = (typeof TIME_SLOTS)[number]["id"];
const BOOKABLE_SLOTS: readonly SlotId[] = ["morning", "afternoon"];

// Dates are offered 6 at a time; "Show more dates" adds 6 more, up to how far
// ahead the admin lets customers book.
const DAYS_PER_PAGE = 6;

// Whether a slot on a date can be booked under the admin's rules: not already
// started (the same-day cutoff), not on a closed day, within the day limit and
// with enough notice. The server checks the same rules again on submit.
function isSlotBookable(rules: BookingRules, dateStr: string, slotId: SlotId) {
  return checkBookable(rules, dateStr, TIME_SLOT_WINDOWS[slotId].start).ok;
}

// The same, ignoring closed days and the pause: is the *time* still possible?
// A day that fails only because it is closed is shown as "Closed", a day whose
// slots have all run out of time or notice as "Unavailable".
function isSlotTimeOk(rules: BookingRules, dateStr: string, slotId: SlotId) {
  return isSlotBookable({ ...rules, paused: false, blackoutDates: [] }, dateStr, slotId);
}

// The earliest slot still bookable on a date, if any.
function firstBookableSlot(rules: BookingRules, dateStr: string): SlotId | null {
  return BOOKABLE_SLOTS.find((slot) => isSlotBookable(rules, dateStr, slot)) ?? null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface OfferedDay {
  label: string;
  month: string;
  date: number;
  full: string;
  // Why the day can't be picked, if it can't.
  unavailable: "closed" | "unavailable" | null;
}

// "Today" is New York's today, not the browser's, so the offered dates match the
// business calendar for a customer booking from another timezone. The first day
// offered is the first one with a slot whose time still works (today, unless
// every slot has passed or lacks the notice). Returns the days to show for the
// first `count` offered days, and whether the admin's limit allows more.
function getOfferedDays(rules: BookingRules, count: number): { days: OfferedDay[]; hasMore: boolean } {
  const today = nyTodayStr();
  const last = addDaysToDateStr(today, rules.maxDaysAhead);

  let cursor = today;
  while (cursor <= last && !BOOKABLE_SLOTS.some((slot) => isSlotTimeOk(rules, cursor, slot))) {
    cursor = addDaysToDateStr(cursor, 1);
  }

  const days: OfferedDay[] = [];
  while (cursor <= last && days.length < count) {
    // cursor is a NY calendar date; read its weekday/day-of-month in UTC so the
    // labels don't drift with the browser zone.
    const [y, m, d] = cursor.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    days.push({
      label: DAY_NAMES[dt.getUTCDay()],
      month: MONTH_NAMES[dt.getUTCMonth()],
      date: dt.getUTCDate(),
      full: cursor,
      unavailable: rules.blackoutDates.includes(cursor)
        ? "closed"
        : BOOKABLE_SLOTS.some((slot) => isSlotTimeOk(rules, cursor, slot))
          ? null
          : "unavailable",
    });
    cursor = addDaysToDateStr(cursor, 1);
  }
  return { days, hasMore: cursor <= last };
}

function DateTimePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const store = useBookingStore();
  const { setStep4 } = store;

  useEffect(() => {
    if (!store.address) router.replace("/residential");
  }, [store.address, router]);

  const { rules } = useBookingRules();

  // The number of dates asked for, grown by "Show more dates". A date chosen
  // earlier (before a reload, say) is always shown, however far out it is.
  const [pages, setPages] = useState(1);
  const storedOffset = store.date
    ? Math.round(
        (Date.parse(`${store.date}T00:00:00Z`) - Date.parse(`${nyTodayStr()}T00:00:00Z`)) / 86_400_000,
      ) + 1
    : 0;
  const count = Math.max(pages * DAYS_PER_PAGE, Math.min(storedOffset, rules.maxDaysAhead + 1));
  const { days, hasMore } = getOfferedDays(rules, count);

  // The chosen date is only kept while it is still one the rules offer: a stale
  // sessionStorage date, or one the admin has since closed, falls back. With no
  // choice yet, the second open day (not today's same-day rush) is preselected.
  const open = days.filter((day) => !day.unavailable);
  const [picked, setPicked] = useState<string | null>(store.date || null);
  const selectedDate = open.some((day) => day.full === picked)
    ? picked
    : (open[1]?.full ?? open[0]?.full ?? null);

  // The slot follows the same rule: the stored one if the date still allows it,
  // else the first slot that works.
  const [pickedSlot, setPickedSlot] = useState<SlotId>(store.timeSlot ?? "morning");
  const selectedSlot =
    selectedDate === null
      ? null
      : isSlotBookable(rules, selectedDate, pickedSlot)
        ? pickedSlot
        : firstBookableSlot(rules, selectedDate);

  function handleNext() {
    if (selectedDate === null || selectedSlot === null) return;
    setStep4(selectedDate, selectedSlot);
    router.push(returnTo === "review" ? "/residential/review" : "/residential/contact");
  }

  // Month label built through lib/datetime.ts so it reflects New York's current
  // month, not the browser's (finding 12 / B8 leftovers).
  const monthLabel = formatNy(new Date(), { month: "long", year: "numeric" });

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

        {store.dateExpired && <DateExpiredNotice />}

        {/* Month label — arrows removed until B10 (finding 9) */}
        <div className="hidden lg:flex items-center gap-2 text-sm font-medium text-zinc-700">
          <span>{monthLabel}</span>
        </div>

        {/* Date chips — mobile: horizontal scroll with top padding so the focus
            ring isn't clipped; desktop: 3-col grid (overflow visible). */}
        <SelectableGroup
          type="radio"
          aria-label="Select a date"
          className="flex gap-2 overflow-x-auto pt-1 pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pt-0 lg:pb-0 lg:gap-3"
        >
          {days.map((day, i) => {
            // The month under a chip when it starts a month, so dates a few weeks
            // out aren't a bare number.
            const showMonth = i === 0 || day.month !== days[i - 1].month;
            const note = day.unavailable === "closed" ? "Closed" : day.unavailable ? "Unavailable" : null;
            return (
              <Selectable
                key={day.full}
                value={day.full}
                aria-label={`${day.label} ${day.month} ${day.date}${note ? `, ${note}` : ""}`}
                selected={selectedDate === day.full}
                disabled={day.unavailable !== null}
                hideCheck
                onSelect={() => setPicked(day.full)}
                className="flex flex-col items-center justify-center min-w-[52px] h-16 lg:h-[72px] flex-shrink-0"
              >
                <span className="text-xs">{day.label}</span>
                <span className="text-lg font-bold">{day.date}</span>
                {(note || showMonth) && <span className="text-[10px]">{note ?? day.month}</span>}
              </Selectable>
            );
          })}
        </SelectableGroup>

        {hasMore && (
          <button
            type="button"
            onClick={() => setPages((p) => p + 1)}
            className="self-start text-sm font-medium text-primary hover:underline"
          >
            Show more dates
          </button>
        )}

        {selectedDate === null && (
          <p role="status" className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            {hasMore
              ? "None of these dates are open. Choose Show more dates to see later ones."
              : `No dates are open to book online right now. Please call us at ${BUSINESS_PHONE.display}.`}
          </p>
        )}

        {/* Time slots */}
        <div className="flex flex-col gap-3">
          <h2 id="time-slot-label" className="text-base font-semibold text-zinc-900">
            Preferred Time
          </h2>

          {/* Mobile: stacked, Desktop: row */}
          <SelectableGroup
            type="radio"
            aria-labelledby="time-slot-label"
            className="flex flex-col gap-3 lg:flex-row"
          >
            {TIME_SLOTS.map((slot) => {
              // A slot is disabled when the rules rule it out for the chosen date:
              // already started, too little notice, or the day is closed.
              const disabled = selectedDate === null || !isSlotBookable(rules, selectedDate, slot.id);
              const sub = disabled ? "Unavailable" : slot.sub;
              return (
                <Selectable
                  key={slot.id}
                  value={slot.id}
                  selected={selectedSlot === slot.id && !disabled}
                  disabled={disabled}
                  onSelect={() => setPickedSlot(slot.id)}
                  className="block w-full p-4 text-left lg:flex-1 lg:text-center"
                >
                  <span
                    className={`text-base font-semibold ${
                      disabled ? "" : "text-zinc-900 group-data-selected:text-white"
                    }`}
                  >
                    {slot.label}
                  </span>
                  <span
                    className={`block text-xs font-normal mt-1 ${
                      disabled ? "text-zinc-400" : "text-zinc-500 group-data-selected:text-white"
                    }`}
                  >
                    {sub}
                  </span>
                </Selectable>
              );
            })}
          </SelectableGroup>
        </div>

        {/* Desktop inline CTA */}
        <div className="hidden lg:block mt-2">
          <button
            onClick={handleNext}
            disabled={selectedDate === null || selectedSlot === null}
            className="w-[360px] h-14 rounded-xl bg-primary text-white text-base font-semibold hover:bg-primary-pressed transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {returnTo === "review" ? "Save & Return to Review" : "Next \u2192"}
          </button>
          <div className="mt-3">
            <Link href="/residential/property" className="text-sm font-medium text-primary hover:underline">
              &larr; Back
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile fixed CTA */}
      <div className="lg:hidden">
        <BottomCTA
          label={returnTo === "review" ? "Save & Return to Review" : "Next"}
          onClick={handleNext}
          disabled={selectedDate === null || selectedSlot === null}
        />
      </div>
    </>
  );
}

export default function DateTimePage() {
  return (
    <WhenHydrated>
      <DateTimePageContent />
    </WhenHydrated>
  );
}
