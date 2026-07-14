"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg } from "@fullcalendar/core";
import { JOBS, EMPLOYEE_MAP, STATUS_CONFIG } from "../data/mock";

// Convert mock jobs to FullCalendar event objects
const FC_EVENTS = JOBS.map((job) => ({
  id: job.id,
  title: job.client,
  start: job.start,
  end: job.end,
  extendedProps: {
    service: job.service,
    address: job.address,
    status: job.status,
    employee: job.employeeId ? EMPLOYEE_MAP[job.employeeId] : null,
  },
}));

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

export default function AdminCalendarPage() {
  return (
    <>
      {/* Page header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-zinc-200 flex items-center px-8 justify-between">
        <div>
          <h1 className="font-bold text-lg text-zinc-900 leading-tight">Calendar</h1>
          <p className="text-sm text-zinc-400">Weekly Schedule</p>
        </div>
        <span className="text-sm text-zinc-400">
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
        </span>
      </header>

      {/* Calendar */}
      <div className="flex-1 overflow-auto p-0 admin-calendar">
        <FullCalendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate="2026-04-14"
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
              click: () => {},
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
          events={FC_EVENTS}
          eventContent={(info) => <JobCard info={info} />}
          height="100%"
          expandRows={true}
          nowIndicator={true}
          dayHeaderFormat={{ weekday: "short", month: "numeric", day: "numeric", omitCommas: true }}
          eventMinHeight={60}
        />
      </div>
    </>
  );
}
