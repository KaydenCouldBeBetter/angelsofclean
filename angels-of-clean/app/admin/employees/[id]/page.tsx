import Link from "next/link";
import {
  getEmployeeById,
  getEmployeeHistory,
  getEmployeeJobsInRange,
} from "@/lib/supabase/queries";
import { addDaysToDateStr, formatNy, formatNyTimeRange, nyTodayStr } from "@/lib/datetime";
import { isUuid } from "@/lib/admin-customers";
import { groupJobsByDay, parseViewParam, parseWeekParam, weekStartOf } from "@/lib/admin-employees";
import type { EmployeeHistoryEntry, Job } from "@/lib/admin-types";
import { DASHBOARD_STATUS } from "../../status-config";
import LoadError from "../../LoadError";
import ArchiveButton from "../ArchiveButton";
import EmployeeCalendar from "./EmployeeCalendar";

const HISTORY_LABEL: Record<EmployeeHistoryEntry["action"], string> = {
  hired: "Hired",
  archived: "Archived",
  reactivated: "Reactivated",
};

// A date-only string shown as a label: anchored at noon UTC so New York never
// shifts it to the day before.
const dayLabel = (date: string, options: Intl.DateTimeFormatOptions) =>
  formatNy(`${date}T12:00:00Z`, options);

function Header({ subtitle }: { subtitle: string }) {
  return (
    <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8 justify-between">
      <div>
        <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">Employee Schedule</h1>
        <p className="text-xs text-[#5c5c5e]">{subtitle}</p>
      </div>
      <Link href="/admin/employees" className="text-sm font-medium text-primary hover:underline">
        Back to Employees
      </Link>
    </header>
  );
}

function NotFound() {
  return (
    <>
      <Header subtitle="Not found" />
      <div className="flex-1 overflow-auto bg-[#f7f9f8] p-8">
        <p className="text-sm text-[#1c1c1e]">Employee not found.</p>
      </div>
    </>
  );
}

function JobRow({ job }: { job: Job }) {
  const cfg = DASHBOARD_STATUS[job.status];
  return (
    <li>
      <Link
        href={`/admin/bookings/${job.id}`}
        className="flex items-center justify-between gap-4 rounded-lg border border-[#e2e8e6] bg-white px-4 py-3 hover:bg-[#f7f9f8] transition-colors"
      >
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#1c1c1e]">
            {formatNyTimeRange(job.start, job.end)} · {job.client}
          </p>
          <p className="truncate text-xs text-[#5c5c5e]">
            #{job.bookingNumber} · {job.service} · {job.address}
          </p>
        </div>
        <span className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${cfg.chipBg} ${cfg.chipText}`}>
          {cfg.label}
        </span>
      </Link>
    </li>
  );
}

export default async function EmployeeSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string | string[]; view?: string | string[] }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) return <NotFound />;

  const today = nyTodayStr();
  const query = await searchParams;
  const weekStart = parseWeekParam(query.week, today);
  const view = parseViewParam(query.view);
  const weekEnd = addDaysToDateStr(weekStart, 6);

  const [employeeResult, jobsResult, historyResult] = await Promise.all([
    getEmployeeById(id),
    // The calendar loads its own jobs for whatever dates are on screen.
    view === "list" ? getEmployeeJobsInRange(id, weekStart, weekEnd) : Promise.resolve({ ok: true as const, data: [] as Job[] }),
    getEmployeeHistory(id),
  ]);

  // A failed lookup is not "this employee does not exist".
  if (!employeeResult.ok || !jobsResult.ok) {
    return (
      <>
        <Header subtitle="Weekly schedule" />
        <LoadError what="this schedule" />
      </>
    );
  }

  const employee = employeeResult.data;
  if (!employee) return <NotFound />;

  const archived = employee.archivedAt !== null;
  const days = groupJobsByDay(jobsResult.data, weekStart);
  const isCurrentWeek = weekStart === weekStartOf(today);
  const weekLabel = `${dayLabel(weekStart, { month: "short", day: "numeric" })} – ${dayLabel(weekEnd, { month: "short", day: "numeric", year: "numeric" })}`;
  const viewHref = (next: "list" | "calendar") => `?view=${next}&week=${weekStart}`;
  const navLink =
    "rounded-lg border border-[#e2e8e6] bg-white px-4 py-2 text-xs font-semibold text-primary hover:bg-[#eef1ef] transition-colors";

  return (
    <>
      <Header subtitle={employee.name} />

      <div className="flex-1 overflow-auto bg-[#f7f9f8]">
        <div className="p-8 grid grid-cols-[1fr_300px] gap-6 items-start">
          {/* Schedule */}
          <section aria-labelledby="week-heading">
            <div className="flex items-center justify-between mb-4">
              <h2 id="week-heading" className="font-semibold text-[17px] text-[#1c1c1e]">
                {view === "list" ? weekLabel : "Calendar"}
              </h2>
              <nav aria-label="Schedule view" className="flex gap-2">
                {(["list", "calendar"] as const).map((option) => (
                  <Link
                    key={option}
                    href={viewHref(option)}
                    aria-current={view === option ? "page" : undefined}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                      view === option ? "bg-primary text-white" : "border border-[#e2e8e6] bg-white text-[#5c5c5e] hover:bg-[#eef1ef]"
                    }`}
                  >
                    {option === "list" ? "List" : "Calendar"}
                  </Link>
                ))}
              </nav>
            </div>

            {view === "calendar" ? (
              <EmployeeCalendar employeeId={employee.id} employeeName={employee.name} initialDate={weekStart} />
            ) : (
              <>
                <nav aria-label="Week" className="flex gap-2 mb-4">
                  <Link href={`?week=${addDaysToDateStr(weekStart, -7)}`} className={navLink}>
                    Previous week
                  </Link>
                  {!isCurrentWeek && (
                    <Link href={`/admin/employees/${employee.id}`} className={navLink}>
                      This week
                    </Link>
                  )}
                  <Link href={`?week=${addDaysToDateStr(weekStart, 7)}`} className={navLink}>
                    Next week
                  </Link>
                </nav>

                <div className="flex flex-col gap-4">
                  {days.map((day) => (
                    <div key={day.date}>
                      <h3 className="mb-2 text-[13px] font-semibold text-[#1c1c1e]">
                        {dayLabel(day.date, { weekday: "long", month: "short", day: "numeric" })}
                        {day.date === today && (
                          <span className="ml-2 rounded-full bg-[#e1f2e7] px-2 py-0.5 text-[11px] font-semibold text-[#166534]">
                            Today
                          </span>
                        )}
                      </h3>
                      {day.jobs.length === 0 ? (
                        <p className="text-xs text-[#5c5c5e]">No jobs</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {day.jobs.map((job) => (
                            <JobRow key={job.id} job={job} />
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Employee */}
          <aside className="flex flex-col gap-4">
            <div className="bg-white border border-[#e2e8e6] rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[17px] text-[#1c1c1e]">{employee.name}</p>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    archived ? "bg-[#f1f3f2] text-[#5c5c5e]" : "bg-[#e1f2e7] text-[#166534]"
                  }`}
                >
                  {archived ? "Archived" : "Active"}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-y-3">
                <div>
                  <dt className="text-[11px] font-semibold text-[#5c5c5e] uppercase">Phone</dt>
                  <dd className="text-[13px] text-[#1c1c1e] mt-0.5">{employee.phone}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold text-[#5c5c5e] uppercase">Hired</dt>
                  <dd className="text-[13px] text-[#1c1c1e] mt-0.5">{employee.hiredDate}</dd>
                </div>
              </dl>
              <ArchiveButton employeeId={employee.id} employeeName={employee.name} archived={archived} />
            </div>

            <div className="bg-white border border-[#e2e8e6] rounded-xl p-5">
              <h2 className="font-semibold text-[15px] text-[#1c1c1e] mb-3">Employment record</h2>
              {!historyResult.ok ? (
                <p role="alert" className="text-xs text-[#c0392b]">The record couldn&apos;t be loaded.</p>
              ) : historyResult.data.length === 0 ? (
                <p className="text-xs text-[#5c5c5e]">Hired {employee.hiredDate}.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {historyResult.data.map((entry) => (
                    <li key={`${entry.action}-${entry.at}`} className="text-[13px] text-[#1c1c1e]">
                      <span className="font-medium">{HISTORY_LABEL[entry.action]}</span>{" "}
                      {formatNy(entry.at, { month: "short", day: "numeric", year: "numeric" })}
                      {entry.actor && <span className="text-[#5c5c5e]"> by {entry.actor}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
