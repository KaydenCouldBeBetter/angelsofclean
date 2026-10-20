import { getJobsInRange, getEmployees } from "@/lib/supabase/queries";
import { formatNy } from "@/lib/datetime";
import { toStaffMap } from "@/lib/admin-types";
import CalendarView from "./CalendarView";
import LoadError from "../LoadError";

export default async function AdminCalendarPage() {
  const [jobs, employees] = await Promise.all([getJobsInRange(), getEmployees()]);

  return (
    <>
      {/* Page header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-zinc-200 flex items-center px-8 justify-between">
        <div>
          <h1 className="font-bold text-lg text-zinc-900 leading-tight">Calendar</h1>
          <p className="text-sm text-zinc-500">Weekly Schedule</p>
        </div>
        <span className="text-sm text-zinc-500">
          {formatNy(new Date(), { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
        </span>
      </header>

      {/* Calendar */}
      {jobs.ok && employees.ok ? (
        <div className="flex-1 overflow-auto p-0 admin-calendar">
          <CalendarView
            jobs={jobs.data}
            employeeMap={toStaffMap(employees.data)}
          />
        </div>
      ) : (
        <LoadError what="the calendar" />
      )}
    </>
  );
}
