import Link from "next/link";
import { getJobsByDateFilter, getEmployees } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_STATUS, type Job, type JobStatus, type Employee } from "../data/mock";
import { NewBookingButton } from "../NewBookingModal";
import BookingsSearch from "./BookingsSearch";

type FilterTab = "today" | "upcoming" | "past" | "all";

// Group jobs by date
function groupJobsByDate(jobs: Job[]): { date: string; label: string; jobs: Job[] }[] {
  const groups: Record<string, Job[]> = {};
  for (const job of jobs) {
    const dateKey = job.start.slice(0, 10);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(job);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dateJobs]) => {
      const d = new Date(`${dateKey}T12:00:00`);
      const label = d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      return {
        date: dateKey,
        label,
        jobs: dateJobs.sort((a, b) => a.start.localeCompare(b.start)),
      };
    });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${m.toString().padStart(2, "0")}`;
}

function StatusChip({ status }: { status: JobStatus }) {
  const cfg = DASHBOARD_STATUS[status];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-4 py-1 text-[11px] font-semibold ${cfg.chipBg} ${cfg.chipText}`}
    >
      {cfg.label}
    </span>
  );
}

function EmployeeDisplay({ job, employeeMap }: { job: Job; employeeMap: Record<string, Employee> }) {
  if (job.employeeIds.length === 0) {
    return <span className="text-[13px] font-medium text-[#c0392b]">Unassigned</span>;
  }

  if (job.employeeIds.length === 1) {
    const emp = employeeMap[job.employeeIds[0]];
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[#1a6b5a] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-[11px]">{emp.initials}</span>
        </div>
        <span className="text-[13px] text-[#1c1c1e]">{emp.name}</span>
      </div>
    );
  }

  // Multiple employees
  const employees = job.employeeIds.map((id) => employeeMap[id]);
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {employees.map((emp) => (
          <div
            key={emp.id}
            className="w-[30px] h-[30px] rounded-full bg-[#1a6b5a] flex items-center justify-center border-2 border-white flex-shrink-0"
          >
            <span className="text-white font-bold text-[10px]">{emp.initials}</span>
          </div>
        ))}
      </div>
      <span className="text-[12px] font-medium text-[#5c5c5e]">
        {employees.length} assigned
      </span>
    </div>
  );
}

function JobCard({ job, employeeMap }: { job: Job; employeeMap: Record<string, Employee> }) {
  const cfg = DASHBOARD_STATUS[job.status];

  return (
    <Link
      href={`/admin/bookings/${job.id}`}
      className="block bg-white border border-[#e2e8e6] rounded-[10px] overflow-hidden hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center h-[72px] relative">
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[10px]"
          style={{ backgroundColor: cfg.accentColor }}
        />

        {/* Client + service */}
        <div className="pl-5 w-[200px] flex-shrink-0">
          <p className="text-[14px] font-semibold text-[#1c1c1e] truncate">{job.client}</p>
          <p className="text-[12px] text-[#5c5c5e] mt-0.5">{job.service}</p>
        </div>

        {/* Time + address */}
        <div className="w-[240px] flex-shrink-0">
          <p className="text-[13px] font-medium text-[#1c1c1e]">
            {formatTime(job.start)}&ndash;{formatTime(job.end)}
          </p>
          <p className="text-[12px] text-[#5c5c5e] mt-0.5 truncate">{job.address}</p>
        </div>

        {/* Employee */}
        <div className="flex-1 min-w-0">
          <EmployeeDisplay job={job} employeeMap={employeeMap} />
        </div>

        {/* Status chip */}
        <div className="pr-6 flex-shrink-0">
          <StatusChip status={job.status} />
        </div>
      </div>
    </Link>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center h-8 px-5 rounded-md text-[12px] font-semibold transition-colors ${
        active
          ? "bg-[#1a6b5a] text-white"
          : "bg-[#f0f0f0] text-[#5c5c5e] font-medium hover:bg-[#e5e5e5]"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string }>;
}) {
  const params = await searchParams;
  const activeTab: FilterTab = (params.filter as FilterTab) || "today";
  const searchQuery = (params.search ?? "").toLowerCase();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = user?.email ?? "admin";

  const [jobs, employees] = await Promise.all([getJobsByDateFilter(activeTab), getEmployees()]);
  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;

  // Date filtering + sorting is now handled by the query.
  // Only client-side search filtering remains.
  const filteredJobs = searchQuery
    ? jobs.filter((job) => {
        const employeeNames = job.employeeIds
          .map((id) => employeeMap[id]?.name ?? "")
          .join(" ")
          .toLowerCase();
        return (
          job.client.toLowerCase().includes(searchQuery) ||
          job.address.toLowerCase().includes(searchQuery) ||
          job.service.toLowerCase().includes(searchQuery) ||
          job.status.toLowerCase().includes(searchQuery) ||
          String(job.bookingNumber).includes(searchQuery) ||
          (job.email?.toLowerCase().includes(searchQuery) ?? false) ||
          (job.phone?.includes(searchQuery) ?? false) ||
          employeeNames.includes(searchQuery)
        );
      })
    : jobs;
  const dayGroups = groupJobsByDate(filteredJobs);

  const displayDate = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });

  const emptyMessages: Record<FilterTab, string> = {
    today: "No bookings scheduled for today.",
    upcoming: "No upcoming bookings.",
    past: "No past bookings.",
    all: "No bookings yet.",
  };

  return (
    <>
      {/* Header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8 justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">
            Bookings
          </h1>
          <p className="text-xs text-[#5c5c5e]">All scheduled jobs</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#5c5c5e]">{displayDate}</span>
          <NewBookingButton adminEmail={adminEmail} />
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex-shrink-0 h-14 bg-white border-b border-[#e2e8e6] flex items-center px-8 gap-2">
        {/* Segment tabs */}
        <TabLink href="/admin/bookings?filter=all" active={activeTab === "all"} >
          All
        </TabLink>
        <TabLink href="/admin/bookings?filter=today" active={activeTab === "today"}>
          Today
        </TabLink>
        <TabLink href="/admin/bookings?filter=upcoming" active={activeTab === "upcoming"}>
          Upcoming
        </TabLink>
        <TabLink href="/admin/bookings?filter=past" active={activeTab === "past"}>
          Past
        </TabLink>


        {/* Dropdown filters */}
        <button className="h-8 px-4 rounded-md border border-[#e2e8e6] bg-white text-[#5c5c5e] text-[12px] font-medium ml-2">
          All Status &nbsp;&#9662;
        </button>
        <button className="h-8 px-4 rounded-md border border-[#e2e8e6] bg-white text-[#5c5c5e] text-[12px] font-medium">
          All Employees &nbsp;&#9662;
        </button>

        {/* Search */}
        <BookingsSearch />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#f7f9f8]">
        <div className="p-8">
          {dayGroups.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#5c5c5e]">
              {searchQuery
                ? `No bookings matching "${params.search}".`
                : emptyMessages[activeTab]}
            </div>
          ) : (
            dayGroups.map((group, groupIdx) => {
              const isToday = group.date === todayStr;

              return (
                <div key={group.date} className={groupIdx > 0 ? "mt-6" : ""}>
                  {/* Day divider (not first group) */}
                  {groupIdx > 0 && <div className="h-px bg-[#e2e8e6] mb-4" />}

                  {/* Day header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[14px] font-semibold text-[#1c1c1e]">
                        {group.label}
                      </h3>
                      {isToday && (
                        <span className="bg-[#1a6b5a] text-white text-[10px] font-semibold px-3 py-0.5 rounded-full">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-[#5c5c5e]">
                      {group.jobs.length} job{group.jobs.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Job cards */}
                  <div className="flex flex-col gap-2">
                    {group.jobs.map((job) => (
                      <JobCard key={job.id} job={job} employeeMap={employeeMap} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
