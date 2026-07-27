import Link from "next/link";
import { getJobs, getEmployees } from "@/lib/supabase/queries";
import { DASHBOARD_STATUS, type Job, type JobStatus } from "../data/mock";

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, "0")}`;
}

function timeRange(job: Job) {
  return `${formatTime(job.start)}–${formatTime(job.end)}`;
}

function StatusChip({ status }: { status: JobStatus }) {
  const cfg = DASHBOARD_STATUS[status];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-4 py-1 text-xs font-semibold ${cfg.chipBg} ${cfg.chipText}`}
    >
      {cfg.label}
    </span>
  );
}

export default async function AdminDashboardPage() {
  const [jobs, employees] = await Promise.all([getJobs(), getEmployees()]);
  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const todayJobs = jobs
    .filter((job) => job.start.startsWith(todayStr) && job.status !== "cancelled")
    .sort((a, b) => a.start.localeCompare(b.start));

  const weekStart = new Date(`${todayStr}T00:00:00`);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekJobs = jobs.filter((job) => {
    const date = new Date(job.start);
    return date >= weekStart && date <= weekEnd;
  });

  const inProgressCount = todayJobs.filter((job) => job.status === "active").length;
  const pendingCount = todayJobs.filter((job) => job.status === "pending").length;
  const activeEmployees = new Set(
    todayJobs.flatMap((job) => job.employeeIds),
  ).size;
  const completedThisWeek = weekJobs.filter((job) => job.status === "done").length;

  const STAT_CARDS = [
    {
      label: "Today's Bookings",
      value: String(todayJobs.length),
      sub: `${inProgressCount} in progress`,
      accent: "#1a6b5a",
    },
    {
      label: "Pending Confirmation",
      value: String(pendingCount),
      sub: "Action required",
      accent: "#d97706",
    },
    {
      label: "Active Employees",
      value: `${activeEmployees}/${employees.length}`,
      sub: `${Math.max(employees.length - activeEmployees, 0)} unavailable today`,
      accent: "#1d4ed8",
    },
    {
      label: "Completed This Week",
      value: String(completedThisWeek),
      sub: "This week",
      accent: "#15803d",
    },
  ];

  const displayDate = now.toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <>
      {/* Header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8 justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">
            Dashboard
          </h1>
          <p className="text-xs text-[#5c5c5e]">Overview for today</p>
        </div>
        <span className="text-sm text-[#5c5c5e]">{displayDate}</span>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#f7f9f8]">
        <div className="p-8">
          {/* Stat Cards */}
          <div className="grid grid-cols-4 gap-5">
            {STAT_CARDS.map((card) => (
              <div
                key={card.label}
                className="bg-white border border-[#e2e8e6] rounded-xl overflow-hidden relative"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  style={{ backgroundColor: card.accent }}
                />
                <div className="py-5 px-5 pl-6">
                  <p className="text-xs text-[#5c5c5e]">{card.label}</p>
                  <p
                    className="text-3xl font-bold mt-2"
                    style={{ color: card.accent }}
                  >
                    {card.value}
                  </p>
                  <p className="text-xs text-[#5c5c5e] mt-3">{card.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Today's Jobs header */}
          <div className="flex items-center justify-between mt-10 mb-4">
            <h2 className="font-semibold text-[17px] text-[#1c1c1e]">
              Today&apos;s Jobs
            </h2>
            <button className="bg-[#1a6b5a] hover:bg-[#155a4b] text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors">
              + New Booking
            </button>
          </div>

          {/* Jobs Table */}
          <div className="bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
            {todayJobs.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#5c5c5e]">
                No bookings scheduled for today yet.
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_1fr_1.6fr_0.8fr_1fr_0.8fr_0.5fr] bg-[#f7f9f8] border-b border-[#e2e8e6] px-6 py-3">
                  {[
                    "Client",
                    "Service",
                    "Address",
                    "Time",
                    "Employee",
                    "Status",
                    "",
                  ].map((col) => (
                    <span
                      key={col}
                      className="text-[11px] font-semibold text-[#5c5c5e] uppercase tracking-wide"
                    >
                      {col}
                    </span>
                  ))}
                </div>

                {/* Table Rows */}
                {todayJobs.map((job) => {
                  const employee = job.employeeIds.length > 0
                    ? employeeMap[job.employeeIds[0]]
                    : null;

                  return (
                    <div
                      key={job.id}
                      className="grid grid-cols-[1fr_1fr_1.6fr_0.8fr_1fr_0.8fr_0.5fr] items-center px-6 py-5 border-b border-[#e2e8e6] last:border-b-0"
                    >
                      <span className="text-sm font-semibold text-[#1c1c1e]">
                        {job.client}
                      </span>
                      <span className="text-[13px] text-[#5c5c5e]">
                        {job.service}
                      </span>
                      <span className="text-[13px] text-[#5c5c5e]">
                        {job.address}
                      </span>
                      <span className="text-[13px] font-medium text-[#1c1c1e]">
                        {timeRange(job)}
                      </span>
                      <span
                        className={`text-[13px] ${
                          employee ? "text-[#1c1c1e]" : "text-[#c0392b]"
                        }`}
                      >
                        {employee ? employee.name : "Unassigned"}
                      </span>
                      <StatusChip status={job.status} />
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/bookings/${job.id}`}
                          className="bg-[#f7f9f8] border border-[#e2e8e6] text-[#1c1c1e] text-xs font-medium px-4 py-1.5 rounded-md hover:bg-[#eef1ef] transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
