"use client";

import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventContentArg } from "@fullcalendar/core";
import { STATUS_CONFIG } from "../../status-config";
import type { Job } from "@/lib/admin-types";
import { employeeJobsUrl, toCalendarEvent } from "@/lib/admin-employees";
import { formatWallClockTime, nyTodayStr, nyWallClockISO } from "@/lib/datetime";

// FullCalendar runs with timeZone="UTC" here, so its Dates are UTC-flavored:
// read them with getUTC* (same convention as the main admin calendar).
function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function EventCard({ info }: { info: EventContentArg }) {
  const { service, status } = info.event.extendedProps;
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];

  // The month grid has room for one line per job.
  if (info.view.type === "dayGridMonth") {
    return (
      <div className={`flex w-full items-center gap-1 overflow-hidden rounded-sm border-l-[3px] px-1.5 py-0.5 ${cfg.cardBg} ${cfg.borderColor}`}>
        <span className="text-[10px] text-zinc-600 flex-shrink-0">{info.timeText}</span>
        <span className="truncate text-[11px] font-semibold text-zinc-900">{info.event.title}</span>
      </div>
    );
  }

  return (
    <div className={`flex h-full w-full flex-col justify-between overflow-hidden rounded-sm border-l-[3px] px-2 py-1.5 ${cfg.cardBg} ${cfg.borderColor}`}>
      <span className="truncate text-xs font-semibold leading-tight text-zinc-900">{info.event.title}</span>
      <span className="truncate text-[11px] text-zinc-600">{service}</span>
      <span className={`mt-auto w-fit rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${cfg.chipBg} ${cfg.chipText}`}>
        {cfg.label}
      </span>
    </div>
  );
}

// One employee's jobs on a week or month grid. Jobs are fetched for whatever
// range is on screen, from the jobs API narrowed to this employee.
export default function EmployeeCalendar({
  employeeId,
  employeeName,
  initialDate,
}: {
  employeeId: string;
  employeeName: string;
  initialDate: string; // "YYYY-MM-DD", New York
}) {
  const calendarRef = useRef<FullCalendar>(null);
  // Set when the visible dates failed to load, so blank days aren't read as
  // "no jobs".
  const [loadFailed, setLoadFailed] = useState(false);

  return (
    <div role="region" aria-label={`${employeeName}'s calendar`} className="admin-calendar overflow-hidden rounded-xl border border-[#e2e8e6] bg-white">
      {loadFailed && (
        <div role="alert" className="flex items-center justify-between gap-4 border-b border-[#c0392b] bg-[#feefee] px-4 py-3">
          <p className="text-[13px] text-[#1c1c1e]">
            <span className="font-semibold">We couldn&apos;t load jobs for these dates.</span> Days that look empty may not be.
          </p>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().refetchEvents()}
            className="h-8 flex-shrink-0 rounded-lg border border-[#c0392b] bg-white px-3 text-[13px] font-semibold text-[#c0392b] hover:bg-[#fde2e0] transition-colors"
          >
            Try again
          </button>
        </div>
      )}
      <div className="h-[680px]">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin]}
          initialView="timeGridWeek"
          timeZone="UTC"
          now={() => nyWallClockISO(new Date())}
          initialDate={initialDate || nyTodayStr()}
          // Monday first, like the list view's weeks.
          firstDay={1}
          headerToolbar={{ left: "title prev,next today", center: "", right: "timeGridWeek,dayGridMonth" }}
          buttonText={{ prev: "‹", next: "›", today: "Today", week: "Week", month: "Month" }}
          views={{ timeGridWeek: { titleFormat: { month: "short", day: "numeric" } } }}
          slotMinTime="07:00:00"
          slotMaxTime="17:00:00"
          slotDuration="01:00:00"
          slotLabelFormat={(arg) => formatWallClockTime(arg.date.marker)}
          allDaySlot={false}
          events={(info, success, failure) => {
            fetch(employeeJobsUrl(employeeId, toDateStr(info.start), toDateStr(info.end)))
              .then((res) => {
                if (!res.ok) throw new Error(`jobs request failed: ${res.status}`);
                return res.json() as Promise<Job[]>;
              })
              .then((jobs) => {
                setLoadFailed(false);
                success(jobs.map(toCalendarEvent));
              })
              .catch((error) => {
                setLoadFailed(true);
                failure(error);
              });
          }}
          eventContent={(info) => <EventCard info={info} />}
          height="100%"
          expandRows={true}
          nowIndicator={true}
          dayHeaderFormat={{ weekday: "short", month: "numeric", day: "numeric", omitCommas: true }}
          eventMinHeight={60}
        />
      </div>
    </div>
  );
}
