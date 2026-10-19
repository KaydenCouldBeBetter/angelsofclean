"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg, DatesSetArg, DayCellContentArg } from "@fullcalendar/core";
import { STATUS_CONFIG } from "../status-config";
import type { Job, StaffMember } from "@/lib/admin-types";
import NewBookingModal from "../NewBookingModal";
import {
  formatNy,
  formatNyTimeRange,
  formatWallClockTime,
  nyDateStr,
  nyTodayStr,
  nyWallClockISO,
} from "@/lib/datetime";

interface CalendarViewProps {
  jobs: Job[];
  employeeMap: Record<string, StaffMember>;
}

// FullCalendar is configured with timeZone="UTC" (UTC-coercion — no timezone
// plugin needed). We feed it each job's New York wall-clock time as an
// offset-less ISO string, so an 8 AM New York job always renders at the 8:00
// slot regardless of the viewer's browser zone. In this mode FullCalendar's
// own Date objects (e.g. from datesSet) are UTC-flavored, so read them with
// getUTC* methods.
function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// The range the server already sent: ±2 months from New York's today, to match
// getJobsInRange's server-side default.
function initialLoadedRange(): { from: string; to: string } {
  const anchor = new Date(`${nyTodayStr()}T00:00:00Z`);
  const start = new Date(anchor);
  start.setUTCMonth(start.getUTCMonth() - 2);
  const end = new Date(anchor);
  end.setUTCMonth(end.getUTCMonth() + 2);
  return { from: toDateStr(start), to: toDateStr(end) };
}

// A job still needs a crew while it is pending, confirmed or in progress.
// Cancelled and finished jobs with no crew are not a to-do.
export function isUnassigned(job: Job): boolean {
  return job.employeeIds.length === 0 && job.status !== "cancelled" && job.status !== "done";
}

// Unassigned jobs grouped by their New York date ("YYYY-MM-DD"), each day in
// start order.
export function unassignedByDay(jobs: Job[]): Map<string, Job[]> {
  const byDay = new Map<string, Job[]>();
  const sorted = jobs.filter(isUnassigned).sort((a, b) => a.start.localeCompare(b.start));
  for (const job of sorted) {
    const day = nyDateStr(job.start);
    byDay.set(day, [...(byDay.get(day) ?? []), job]);
  }
  return byDay;
}

function jobsLabel(count: number): string {
  return `${count} unassigned job${count !== 1 ? "s" : ""}`;
}

interface UnassignedTrayProps {
  // Unassigned jobs by NY date, as from unassignedByDay().
  byDay: Map<string, Job[]>;
  // The visible week: first day inclusive, last day exclusive ("YYYY-MM-DD").
  from: string;
  to: string;
}

// Pinned above the weekly grid so a job with no crew can't be missed. Every
// job is a real link to its booking, where the crew is assigned, so the tray
// works with Tab and Enter and needs no custom key handling.
export function UnassignedTray({ byDay, from, to }: UnassignedTrayProps) {
  const days = [...byDay.keys()].filter((day) => day >= from && day < to).sort();
  const count = days.reduce((n, day) => n + byDay.get(day)!.length, 0);

  return (
    <section
      aria-labelledby="unassigned-heading"
      className="flex-shrink-0 max-h-[30vh] overflow-y-auto border-b border-zinc-200 bg-white px-4 py-3"
    >
      <h2 id="unassigned-heading" className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
        Unassigned
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            count > 0 ? "bg-[#feefee] text-[#c0392b]" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {count}
        </span>
      </h2>
      {count === 0 ? (
        <p className="mt-1 text-[13px] text-zinc-600">Every job this week has a crew.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {days.map((day) => (
            <div key={day}>
              <h3 className="mb-1 text-xs font-semibold text-zinc-600">
                {formatNy(`${day}T12:00:00Z`, { weekday: "short", month: "short", day: "numeric" })}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {byDay.get(day)!.map((job) => {
                  const cfg = STATUS_CONFIG[job.status];
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/admin/bookings/${job.id}`}
                        className={`flex min-h-11 items-center gap-2 rounded-sm border-l-[3px] px-2 py-1.5 text-xs text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a6b5a] ${cfg.cardBg} ${cfg.borderColor}`}
                      >
                        <span className="font-semibold">{job.client}</span>
                        <span className="text-zinc-600">
                          {formatNyTimeRange(job.start, job.end)} · {job.service}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cfg.chipBg} ${cfg.chipText}`}>
                          {cfg.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Month cell content: the day number, plus a count when the day has unassigned
// jobs. It sits inside the day-number link (made focusable by navLinks), which
// opens that day's week, where the tray lists the jobs. The screen-reader text
// carries the count; the badge is a visual repeat of it.
function DayCell({ arg, count }: { arg: DayCellContentArg; count: number }) {
  return (
    <>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="mr-1 inline-block rounded-full bg-[#feefee] px-1.5 text-[11px] font-semibold text-[#c0392b]"
        >
          {count} unassigned
        </span>
      )}
      {arg.dayNumberText}
      {count > 0 && <span className="sr-only">, {jobsLabel(count)}</span>}
    </>
  );
}

function JobCard({ info }: { info: EventContentArg }) {
  const { service, status, employee } = info.event.extendedProps;
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];

  const startMs = info.event.start?.getTime() ?? 0;
  const endMs   = info.event.end?.getTime()   ?? 0;
  const hrs     = Math.round((endMs - startMs) / 36e5);

  return (
    <div
      className={`
        h-full w-full flex flex-col justify-between
        border-l-[3px] rounded-sm px-2 py-1.5 overflow-hidden
        ${cfg.cardBg} ${cfg.borderColor}
      `}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-1">
        <span className="font-semibold text-zinc-900 text-xs leading-tight truncate">
          {info.event.title}
        </span>
        <span className="text-[10px] text-zinc-600 flex-shrink-0">~{hrs} hr{hrs !== 1 ? "s" : ""}</span>
      </div>

      {/* Service */}
      <span className="text-[11px] text-zinc-500 truncate">{service}</span>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-1 mt-auto pt-1">
        {employee ? (
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-4 h-4 rounded-full bg-[#1b3b36] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
              {employee.initials.slice(0, 2)}
            </span>
            <span className="text-[10px] text-zinc-500 truncate">{employee.name}</span>
          </div>
        ) : (
          <span className="text-[10px] text-[#c0392b] font-medium">Unassigned</span>
        )}
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cfg.chipBg} ${cfg.chipText}`}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

export default function CalendarView({ jobs, employeeMap }: CalendarViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [allJobs, setAllJobs] = useState<Job[]>(jobs);
  // Set when jobs for the visible dates failed to load, so blank days aren't
  // read as "nothing scheduled".
  const [loadFailed, setLoadFailed] = useState(false);
  const lastDatesSet = useRef<DatesSetArg | null>(null);
  // The visible view and its dates (end exclusive), for the Unassigned tray.
  const [view, setView] = useState<{ type: string; from: string; to: string } | null>(null);

  // Track the date range we've already loaded so we don't re-fetch. Only the
  // first render's value is kept; later renders recompute it and discard it.
  const loadedRange = useRef(initialLoadedRange());

  // Called whenever FullCalendar changes its visible date range (navigation).
  const handleDatesSet = useCallback(async (arg: DatesSetArg) => {
    lastDatesSet.current = arg;
    const viewStart = toDateStr(arg.start);
    const viewEnd = toDateStr(arg.end);
    setView({ type: arg.view.type, from: viewStart, to: viewEnd });

    // If the visible range is within what we've already loaded, do nothing.
    if (viewStart >= loadedRange.current.from && viewEnd <= loadedRange.current.to) {
      setLoadFailed(false);
      return;
    }

    // Expand the loaded range to cover the new view (with 1-month padding).
    const newFrom = viewStart < loadedRange.current.from ? viewStart : loadedRange.current.from;
    const newTo = viewEnd > loadedRange.current.to ? viewEnd : loadedRange.current.to;

    // Add 1-month padding so small navigations don't trigger more fetches.
    const paddedFrom = new Date(`${newFrom}T00:00:00Z`);
    paddedFrom.setUTCMonth(paddedFrom.getUTCMonth() - 1);
    const paddedTo = new Date(`${newTo}T00:00:00Z`);
    paddedTo.setUTCMonth(paddedTo.getUTCMonth() + 1);

    const fetchFrom = toDateStr(paddedFrom);
    const fetchTo = toDateStr(paddedTo);

    try {
      const res = await fetch(`/api/admin/jobs?from=${fetchFrom}&to=${fetchTo}`);
      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const newJobs: Job[] = await res.json();

      // Merge: replace any overlapping jobs (by id) and add new ones.
      setAllJobs((prev) => {
        const merged = new Map(prev.map((j) => [j.id, j]));
        for (const job of newJobs) {
          merged.set(job.id, job);
        }
        return Array.from(merged.values());
      });

      loadedRange.current = { from: fetchFrom, to: fetchTo };
      setLoadFailed(false);
    } catch (err) {
      console.error("Failed to fetch calendar jobs", err);
      setLoadFailed(true);
    }
  }, []);

  const fcEvents = allJobs.map((job) => ({
    id: job.id,
    title: job.client,
    // Offset-less New York wall-clock time — see timeZone="UTC" note above.
    start: nyWallClockISO(job.start),
    end: nyWallClockISO(job.end),
    extendedProps: {
      service: job.service,
      address: job.address,
      status: job.status,
      employee: job.employeeIds.length > 0 ? employeeMap[job.employeeIds[0]] : null,
    },
  }));

  const unassigned = unassignedByDay(allJobs);

  return (
    <div className="flex h-full flex-col">
    {loadFailed && (
      <div
        role="alert"
        className="flex items-center justify-between gap-4 border-b border-[#c0392b] bg-[#feefee] px-8 py-3"
      >
        <p className="text-[13px] text-[#1c1c1e]">
          <span className="font-semibold">We couldn&apos;t load jobs for these dates.</span>{" "}
          Days that look empty may not be.
        </p>
        <button
          onClick={() => lastDatesSet.current && handleDatesSet(lastDatesSet.current)}
          className="h-8 flex-shrink-0 rounded-lg border border-[#c0392b] bg-white px-3 text-[13px] font-semibold text-[#c0392b] hover:bg-[#fde2e0] transition-colors"
        >
          Try again
        </button>
      </div>
    )}
    {view?.type === "timeGridWeek" && (
      <UnassignedTray byDay={unassigned} from={view.from} to={view.to} />
    )}
    <div className="min-h-0 flex-1">
    <FullCalendar
      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      // Events carry New York wall-clock times (offset stripped); UTC-coercion
      // then places them at their New York clock position for every viewer.
      timeZone="UTC"
      now={() => nyWallClockISO(new Date())}
      initialDate={nyTodayStr()}
      headerToolbar={{
        left:   "title prev,next today",
        center: "",
        right:  "timeGridWeek,dayGridMonth newBooking",
      }}
      buttonText={{
        prev:  "‹",
        next:  "›",
        today: "Today",
        week:  "Week",
        month: "Month",
      }}
      customButtons={{
        newBooking: {
          text: "+ New Booking",
          click: () => setModalOpen(true),
        },
      }}
      views={{
        timeGridWeek: {
          titleFormat: { month: "short", day: "numeric" },
        },
        // Month day numbers become links (Tab, then Enter) that open that
        // day's week, where the Unassigned tray lists the jobs.
        dayGridMonth: {
          navLinks: true,
          navLinkDayClick: "timeGridWeek",
        },
      }}
      dayCellContent={(arg) => (
        <DayCell arg={arg} count={unassigned.get(toDateStr(arg.date))?.length ?? 0} />
      )}
      slotMinTime="07:00:00"
      slotMaxTime="17:00:00"
      slotDuration="01:00:00"
      slotLabelFormat={(arg) => formatWallClockTime(arg.date.marker)}
      allDaySlot={false}
      weekends={true}
      events={fcEvents}
      eventContent={(info) => <JobCard info={info} />}
      height="100%"
      expandRows={true}
      nowIndicator={true}
      dayHeaderFormat={{ weekday: "short", month: "numeric", day: "numeric", omitCommas: true }}
      eventMinHeight={60}
      datesSet={handleDatesSet}
    />
    </div>
    <NewBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
