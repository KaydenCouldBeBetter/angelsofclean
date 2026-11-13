"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import {
  MAX_DAYS_AHEAD_OPTIONS,
  MIN_NOTICE_OPTIONS,
  daysAheadLabel,
  noticeLabel,
  pauseText,
} from "@/lib/booking-rules";
import { formatNy, formatNyDateTime } from "@/lib/datetime";
import type { BookingControls } from "@/lib/supabase/booking-settings";
import { addBlackoutDate, previewBlackoutDate, removeBlackoutDate, saveBookingSettings } from "./booking-actions";
import SettingsCard, { SELECT_CLASS } from "./SettingsCard";

const dayLabel = (day: string) =>
  formatNy(`${day}T12:00:00Z`, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

// The result line under a form: a polite status that is always in the page (so a
// screen reader announces the text when it appears) and an alert for a failure.
function Outcome({ message, error }: { message: string; error: string | null }) {
  return (
    <>
      <p role="status" className="text-sm text-primary-pressed">
        {message}
      </p>
      {error && (
        <p role="alert" className="rounded-lg border border-[#c0392b] bg-[#feefee] px-3 py-2 text-[13px] text-[#1c1c1e]">
          {error}
        </p>
      )}
    </>
  );
}

function SettingsForm({ settings }: { settings: BookingControls["settings"] }) {
  const [paused, setPaused] = useState(settings.paused);
  const [message, setMessage] = useState(settings.pauseMessage);
  const [notice, setNotice] = useState(settings.minNoticeHours);
  const [daysAhead, setDaysAhead] = useState(settings.maxDaysAhead);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ids = { message: useId(), messageHint: useId(), notice: useId(), days: useId() };

  const touch = () => {
    setSaved("");
    setError(null);
  };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    touch();
    startTransition(async () => {
      const result = await saveBookingSettings({
        paused,
        pauseMessage: message,
        minNoticeHours: notice,
        maxDaysAhead: daysAhead,
      });
      if (result.success) {
        setSaved(
          paused
            ? "Saved. Online booking is paused; customers can't book until you turn this off."
            : "Saved. Customers see this within about 30 seconds.",
        );
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <SettingsCard
        id="online-booking"
        title="Online booking"
        description="Shared by every admin, and it changes what customers can book. Bookings you create yourself are never held to these rules."
      >
        <div>
          <label className="flex min-h-11 items-start gap-2 text-sm text-[#1c1c1e]">
            <input
              type="checkbox"
              checked={paused}
              onChange={(e) => {
                setPaused(e.target.checked);
                touch();
              }}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              Pause online booking
              <span className="block text-xs text-[#5c5c5e]">
                Customers see a notice instead of the booking steps, and a booking in progress is refused. Commercial
                quote requests stay open.
              </span>
            </span>
          </label>
        </div>

        <div className="max-w-xl">
          <Label htmlFor={ids.message} className="mb-1 text-[13px] text-[#1c1c1e]">
            Message customers see while paused
          </Label>
          <textarea
            id={ids.message}
            value={message}
            maxLength={FIELD_MAX_LENGTHS.pauseMessage}
            rows={3}
            onChange={(e) => {
              setMessage(e.target.value);
              touch();
            }}
            aria-describedby={ids.messageHint}
            className="w-full rounded-lg border border-[#767676] bg-white px-3 py-2 text-sm text-[#1c1c1e]"
          />
          <p id={ids.messageHint} className="mt-1 text-xs text-[#5c5c5e]">
            {message.length}/{FIELD_MAX_LENGTHS.pauseMessage}. Leave it blank to show: &ldquo;
            {pauseText({ pauseMessage: "" })}&rdquo;
          </p>
        </div>

        <div className="flex flex-wrap gap-6">
          <div className="w-64">
            <label htmlFor={ids.notice} className="mb-1 block text-[13px] font-medium text-[#1c1c1e]">
              Minimum notice
            </label>
            <select
              id={ids.notice}
              value={notice}
              onChange={(e) => {
                setNotice(Number(e.target.value));
                touch();
              }}
              className={SELECT_CLASS}
            >
              {MIN_NOTICE_OPTIONS.map((hours) => (
                <option key={hours} value={hours}>
                  {noticeLabel(hours)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-64">
            <label htmlFor={ids.days} className="mb-1 block text-[13px] font-medium text-[#1c1c1e]">
              Customers can book up to
            </label>
            <select
              id={ids.days}
              value={daysAhead}
              onChange={(e) => {
                setDaysAhead(Number(e.target.value));
                touch();
              }}
              className={SELECT_CLASS}
            >
              {MAX_DAYS_AHEAD_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {daysAheadLabel(days)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#5c5c5e]">Counted from today, New York time.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={isPending} className="h-11 px-6 text-sm">
            {isPending ? "Saving..." : "Save online booking settings"}
          </Button>
          <Outcome message={saved} error={error} />
        </div>
        {settings.updatedBy && (
          <p className="text-xs text-[#5c5c5e]">
            Last changed by {settings.updatedBy} on {formatNyDateTime(settings.updatedAt)}.
          </p>
        )}
      </SettingsCard>
    </form>
  );
}

function ClosedDays({ blackouts, today }: { blackouts: BookingControls["blackouts"]; today: string }) {
  const [day, setDay] = useState("");
  const [label, setLabel] = useState("");
  // How many bookings the chosen day already has: shown before closing it, so
  // the admin knows what the closure leaves in place.
  const [existing, setExisting] = useState<{ day: string; count: number | null } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const latestDay = useRef("");
  const ids = { day: useId(), label: useId(), labelHint: useId(), existing: useId() };

  function handleDayChange(value: string) {
    setDay(value);
    setMessage("");
    setError(null);
    setExisting(null);
    latestDay.current = value;
    if (!value) return;
    // An answer for a day the admin has since moved off is ignored.
    previewBlackoutDate(value).then((result) => {
      if (latestDay.current !== value) return;
      setExisting({ day: value, count: result.success ? result.bookings : null });
    });
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError(null);
    startTransition(async () => {
      const result = await addBlackoutDate({ day, label });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(`Closed ${dayLabel(day)}.`);
      setDay("");
      setLabel("");
      setExisting(null);
      latestDay.current = "";
    });
  }

  function handleRemove(target: string) {
    setMessage("");
    setError(null);
    startTransition(async () => {
      const result = await removeBlackoutDate(target);
      if (result.success) setMessage(`Reopened ${dayLabel(target)}.`);
      else setError(result.error);
    });
  }

  const count = existing && existing.day === day ? existing.count : undefined;

  return (
    <SettingsCard
      id="closed-days"
      title="Closed days"
      description="Customers can't book these whole days (holidays, time off). Jobs already on a closed day stay where they are."
    >
      {blackouts.length === 0 ? (
        <p className="text-sm text-[#5c5c5e]">No upcoming days are closed.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#e2e8e6] rounded-lg border border-[#e2e8e6]">
          {blackouts.map((b) => (
            <li key={b.day} className="flex items-center justify-between gap-4 px-4 py-2">
              <span className="text-sm text-[#1c1c1e]">
                <span className="font-medium">{dayLabel(b.day)}</span>
                {b.label && <span className="text-[#5c5c5e]"> · {b.label}</span>}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleRemove(b.day)}
                aria-label={`Reopen ${dayLabel(b.day)}`}
                className="h-11 px-4 text-sm"
              >
                Reopen
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-[#1c1c1e]">Close a day</h3>
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-48">
            <Label htmlFor={ids.day} className="mb-1 text-[13px] text-[#1c1c1e]">
              Date
            </Label>
            <Input
              id={ids.day}
              type="date"
              required
              min={today}
              value={day}
              onChange={(e) => handleDayChange(e.target.value)}
              aria-describedby={count !== undefined ? ids.existing : undefined}
              className="h-11"
            />
          </div>
          <div className="w-64">
            <Label htmlFor={ids.label} className="mb-1 text-[13px] text-[#1c1c1e]">
              Label (optional)
            </Label>
            <Input
              id={ids.label}
              maxLength={FIELD_MAX_LENGTHS.blackoutLabel}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-describedby={ids.labelHint}
              className="h-11"
            />
            <p id={ids.labelHint} className="mt-1 text-xs text-[#5c5c5e]">
              For admins only, like &ldquo;Thanksgiving&rdquo;.
            </p>
          </div>
        </div>

        {/* Always in the page, so the count is announced when it appears. */}
        <p
          id={ids.existing}
          role="status"
          className={count ? "rounded-lg border border-[#b45309] bg-[#fef3c7] px-3 py-2 text-[13px] text-[#1c1c1e]" : "text-sm text-[#5c5c5e]"}
        >
          {count === undefined
            ? ""
            : count === null
              ? "We couldn't check for bookings on that day."
              : count === 0
                ? "No bookings are scheduled that day."
                : `${count} booking${count === 1 ? " is" : "s are"} already scheduled that day. Closing it won't cancel ${count === 1 ? "it" : "them"}.`}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={isPending || day === ""} className="h-11 px-6 text-sm">
            {isPending ? "Saving..." : "Close this day"}
          </Button>
          <Outcome message={message} error={error} />
        </div>
      </form>
    </SettingsCard>
  );
}

function RecentChanges({ audit }: { audit: BookingControls["audit"] }) {
  return (
    <SettingsCard id="recent-changes" title="Recent changes" description="Who changed the online booking settings, and when.">
      {audit.length === 0 ? (
        <p className="text-sm text-[#5c5c5e]">Nothing has been changed yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#e2e8e6]">
          {audit.map((entry) => (
            <li key={entry.id} className="py-2 text-sm text-[#1c1c1e]">
              {entry.description}
              <span className="block text-xs text-[#5c5c5e]">
                {entry.actor ?? "An admin"} · {formatNyDateTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}

// The shared online booking controls: the pause and rules, the closed days and
// the audit trail. Every action behind them checks the admin role again.
export default function OnlineBookingSection({
  controls,
  today,
}: {
  controls: BookingControls;
  // New York's today, from the server, so the date picker's minimum can't
  // disagree between the server render and the browser.
  today: string;
}) {
  return (
    <>
      <SettingsForm settings={controls.settings} />
      <ClosedDays blackouts={controls.blackouts} today={today} />
      <RecentChanges audit={controls.audit} />
    </>
  );
}
