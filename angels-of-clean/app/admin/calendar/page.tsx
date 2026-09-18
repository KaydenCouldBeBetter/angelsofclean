import { getJobsInRange, getEmployees } from "@/lib/supabase/queries";
import CalendarView from "./CalendarView";

export default async function AdminCalendarPage() {
  const [jobs, employees] = await Promise.all([getJobsInRange(), getEmployees()]);
  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));

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
        <CalendarView jobs={jobs} employeeMap={employeeMap} />
      </div>
    </>
  );
}
