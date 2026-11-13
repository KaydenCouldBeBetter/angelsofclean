"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import FieldError from "@/components/booking/FieldError";
import {
  BOOKINGS_FILTER_OPTIONS,
  CALENDAR_VIEW_OPTIONS,
  FIRST_HOUR_RANGE,
  LANDING_PAGE_OPTIONS,
  LAST_HOUR_RANGE,
  MIN_VISIBLE_HOURS,
  TRAY_COLLAPSED_KEY,
  WEEK_START_OPTIONS,
  hourLabel,
  validatePreferences,
  type AdminPreferences,
} from "@/lib/admin-preferences";
import { savePreferences } from "./actions";
import SettingsCard, { SELECT_CLASS } from "./SettingsCard";

// A group of radio buttons under a visible legend. Native radios, so arrow keys,
// screen readers and the browser's own focus ring all work.
function RadioGroup<T extends string>({
  legend,
  hint,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const hintId = useId();
  return (
    <fieldset aria-describedby={hint ? hintId : undefined}>
      <legend className="text-[13px] font-medium text-[#1c1c1e]">{legend}</legend>
      {hint && (
        <p id={hintId} className="mt-0.5 text-xs text-[#5c5c5e]">
          {hint}
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-x-6">
        {options.map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-2 text-sm text-[#1c1c1e]">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="h-4 w-4 accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

// Start page, calendar and Bookings list preferences, saved together with one
// button. The server action checks the admin role and every value again.
export default function PreferencesForm({ initial }: { initial: AdminPreferences }) {
  const [prefs, setPrefs] = useState<AdminPreferences>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const ids = { from: useId(), until: useId(), hoursHint: useId(), hoursError: useId(), filter: useId() };

  function change<K extends keyof AdminPreferences>(key: K, value: AdminPreferences[K]) {
    setPrefs((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  }

  // Shown as soon as the two hours are too close, not only after Save.
  const hoursTooClose = prefs.calendarEndHour - prefs.calendarStartHour < MIN_VISIBLE_HOURS;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (hoursTooClose) return; // the message beside the hours is already showing
    const checked = validatePreferences(prefs);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    startTransition(async () => {
      const result = await savePreferences(checked.value);
      if (result.success) {
        setSaved(true);
        // The calendar's own hide/show arrow is remembered per browser and would
        // otherwise keep overriding the default just chosen.
        try {
          window.localStorage.removeItem(TRAY_COLLAPSED_KEY);
        } catch {
          // Storage blocked: nothing to clear.
        }
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <SettingsCard id="start" title="Start page" description="Where you land right after you sign in.">
        <RadioGroup
          legend="Open after signing in"
          name="landingPage"
          options={LANDING_PAGE_OPTIONS}
          value={prefs.landingPage}
          onChange={(v) => change("landingPage", v)}
        />
      </SettingsCard>

      <SettingsCard id="calendar" title="Calendar" description="How the calendar looks when you open it.">
        <RadioGroup
          legend="Opens in"
          name="calendarView"
          options={CALENDAR_VIEW_OPTIONS}
          value={prefs.calendarView}
          onChange={(v) => change("calendarView", v)}
        />
        <RadioGroup
          legend="Week starts on"
          name="weekStartsOn"
          options={WEEK_START_OPTIONS}
          value={prefs.weekStartsOn}
          onChange={(v) => change("weekStartsOn", v)}
        />

        <fieldset aria-describedby={ids.hoursHint}>
          <legend className="text-[13px] font-medium text-[#1c1c1e]">Hours shown in the week view</legend>
          <p id={ids.hoursHint} className="mt-0.5 text-xs text-[#5c5c5e]">
            New York time, at least {MIN_VISIBLE_HOURS} hours. A job outside these hours isn&apos;t drawn in the
            week view; the calendar tells you when that happens.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <div className="w-44">
              <label htmlFor={ids.from} className="mb-1 block text-xs text-[#5c5c5e]">
                From
              </label>
              <select
                id={ids.from}
                value={prefs.calendarStartHour}
                onChange={(e) => change("calendarStartHour", Number(e.target.value))}
                aria-invalid={hoursTooClose || undefined}
                aria-describedby={hoursTooClose ? ids.hoursError : undefined}
                className={SELECT_CLASS}
              >
                {range(FIRST_HOUR_RANGE.min, FIRST_HOUR_RANGE.max).map((hour) => (
                  <option key={hour} value={hour}>
                    {hourLabel(hour)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-52">
              <label htmlFor={ids.until} className="mb-1 block text-xs text-[#5c5c5e]">
                Until
              </label>
              <select
                id={ids.until}
                value={prefs.calendarEndHour}
                onChange={(e) => change("calendarEndHour", Number(e.target.value))}
                aria-invalid={hoursTooClose || undefined}
                aria-describedby={hoursTooClose ? ids.hoursError : undefined}
                className={SELECT_CLASS}
              >
                {range(LAST_HOUR_RANGE.min, LAST_HOUR_RANGE.max).map((hour) => (
                  <option key={hour} value={hour}>
                    {hourLabel(hour)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {hoursTooClose && (
            <div className="mt-2">
              <FieldError id={ids.hoursError}>Show at least {MIN_VISIBLE_HOURS} hours on the calendar.</FieldError>
            </div>
          )}
        </fieldset>

        <div>
          <label className="flex min-h-11 items-start gap-2 text-sm text-[#1c1c1e]">
            <input
              type="checkbox"
              checked={prefs.unassignedListCollapsed}
              onChange={(e) => change("unassignedListCollapsed", e.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              Start with the Unassigned list hidden
              <span className="block text-xs text-[#5c5c5e]">
                The count stays visible. The arrow on the calendar can still show or hide it for a visit.
              </span>
            </span>
          </label>
        </div>
      </SettingsCard>

      <SettingsCard id="bookings" title="Bookings" description="What the Bookings list shows first.">
        <div className="max-w-xs">
          <label htmlFor={ids.filter} className="mb-1 block text-[13px] font-medium text-[#1c1c1e]">
            Show these bookings first
          </label>
          <select
            id={ids.filter}
            value={prefs.bookingsDefaultFilter}
            onChange={(e) => change("bookingsDefaultFilter", e.target.value as AdminPreferences["bookingsDefaultFilter"])}
            className={SELECT_CLASS}
          >
            {BOOKINGS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </SettingsCard>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isPending} className="h-11 px-6 text-sm">
          {isPending ? "Saving..." : "Save preferences"}
        </Button>
        {/* Always in the page, so a screen reader announces the text when it changes. */}
        <p role="status" className="text-sm text-primary-pressed">
          {saved ? "Preferences saved." : ""}
        </p>
        {error && (
          <p role="alert" className="rounded-lg border border-[#c0392b] bg-[#feefee] px-3 py-2 text-[13px] text-[#1c1c1e]">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
