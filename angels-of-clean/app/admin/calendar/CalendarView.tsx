"use client";

import { useState, useRef, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg, DatesSetArg } from "@fullcalendar/core";
import { STATUS_CONFIG, type Job, type Employee } from "../data/mock";
import NewBookingModal from "../NewBookingModal";

interface CalendarViewProps {
  jobs: Job[];
  employeeMap: Record<string, Employee>;
}

/** Format a Date to YYYY-MM-DD without timezone shift. */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
        <span className="text-[10px] text-zinc-400 flex-shrink-0">~{hrs} hr{hrs !== 1 ? "s" : ""}</span>
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
          <span className="text-[10px] text-orange-500 font-medium">Unassigned</span>
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

  // Track the date range we've already loaded so we don't re-fetch.
  const loadedRange = useRef({ from: "", to: "" });

  // Seed the initial loaded range (±2 months from today).
  if (!loadedRange.current.from) {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - 2);
    const end = new Date(now);
    end.setMonth(end.getMonth() + 2);
    loadedRange.current = { from: toDateStr(start), to: toDateStr(end) };
  }

  // Called whenever FullCalendar changes its visible date range (navigation).
  const handleDatesSet = useCallback(async (arg: DatesSetArg) => {
    const viewStart = toDateStr(arg.start);
    const viewEnd = toDateStr(arg.end);

    // If the visible range is within what we've already loaded, do nothing.
    if (viewStart >= loadedRange.current.from && viewEnd <= loadedRange.current.to) {
      return;
    }

    // Expand the loaded range to cover the new view (with 1-month padding).
    const newFrom = viewStart < loadedRange.current.from ? viewStart : loadedRange.current.from;
    const newTo = viewEnd > loadedRange.current.to ? viewEnd : loadedRange.current.to;

    // Add 1-month padding so small navigations don't trigger more fetches.
    const paddedFrom = new Date(`${newFrom}T00:00:00`);
    paddedFrom.setMonth(paddedFrom.getMonth() - 1);
    const paddedTo = new Date(`${newTo}T00:00:00`);
    paddedTo.setMonth(paddedTo.getMonth() + 1);

    const fetchFrom = toDateStr(paddedFrom);
    const fetchTo = toDateStr(paddedTo);

    try {
      const res = await fetch(`/api/admin/jobs?from=${fetchFrom}&to=${fetchTo}`);
      if (!res.ok) return;
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
    } catch (err) {
      console.error("Failed to fetch calendar jobs", err);
    }
  }, []);

  const fcEvents = allJobs.map((job) => ({
    id: job.id,
    title: job.client,
    start: job.start,
    end: job.end,
    extendedProps: {
      service: job.service,
      address: job.address,
      status: job.status,
      employee: job.employeeIds.length > 0 ? employeeMap[job.employeeIds[0]] : null,
    },
  }));

  return (
    <>
    <FullCalendar
      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      initialDate={new Date().toISOString().slice(0, 10)}
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
      }}
      slotMinTime="07:00:00"
      slotMaxTime="17:00:00"
      slotDuration="01:00:00"
      slotLabelFormat={{ hour: "numeric", meridiem: "short" }}
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
    <NewBookingModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
