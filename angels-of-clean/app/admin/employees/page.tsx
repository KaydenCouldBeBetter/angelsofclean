import Link from "next/link";
import { getEmployees, getTodayJobs } from "@/lib/supabase/queries";
import { EMPLOYEE_STATUS_CONFIG } from "../status-config";
import type { Employee, EmployeeStatus, Job } from "@/lib/admin-types";
import { formatNy } from "@/lib/datetime";
import LoadError from "../LoadError";
import AddEmployeeButton from "./AddEmployeeButton";
import ArchiveButton from "./ArchiveButton";

const ARCHIVED_CHIP = "bg-[#f1f3f2] text-[#5c5c5e]";

function getEmployeeStatus(employeeId: string, todayJobs: Job[]): EmployeeStatus {
  const empJobs = todayJobs.filter((job) => job.employeeIds.includes(employeeId));
  if (empJobs.some((job) => job.status === "active")) return "on-a-job";
  if (empJobs.some((job) => job.status === "confirmed")) return "scheduled";
  return "available";
}

function getEmployeeTodayCount(employeeId: string, todayJobs: Job[]): number {
  return todayJobs.filter((job) => job.employeeIds.includes(employeeId)).length;
}

function EmployeeCard({ employee, todayJobs }: { employee: Employee; todayJobs: Job[] }) {
  const archived = employee.archivedAt !== null;
  const status = getEmployeeStatus(employee.id, todayJobs);
  const todayCount = getEmployeeTodayCount(employee.id, todayJobs);
  const cfg = EMPLOYEE_STATUS_CONFIG[status];

  return (
    <div className="bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
      {/* Top section: avatar, name, status */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar with status dot */}
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${archived ? "bg-[#5c5c5e]" : "bg-primary"}`}>
                <span className="text-white font-bold text-sm">{employee.initials}</span>
              </div>
              {!archived && (
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${cfg.dotColor}`}
                />
              )}
            </div>
            <p className="font-semibold text-[17px] text-[#1c1c1e] leading-tight">
              {employee.name}
            </p>
          </div>
          {/* Status chip */}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${archived ? ARCHIVED_CHIP : `${cfg.chipBg} ${cfg.chipText}`}`}
          >
            {archived ? "Archived" : cfg.label}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#e2e8e6] mx-5" />

      {/* Details grid */}
      <div className="px-5 pt-3 pb-4">
        <div className="grid grid-cols-2 gap-y-3">
          <div>
            <p className="text-[11px] font-semibold text-[#5c5c5e] uppercase">Phone</p>
            <p className="text-[13px] text-[#1c1c1e] mt-0.5">{employee.phone}</p>
          </div>
          {archived ? (
            <div>
              <p className="text-[11px] font-semibold text-[#5c5c5e] uppercase">Archived</p>
              <p className="text-[13px] text-[#1c1c1e] mt-0.5">
                {formatNy(employee.archivedAt!, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold text-[#5c5c5e] uppercase">Today</p>
              <p className="text-[13px] text-[#1c1c1e] mt-0.5">
                {todayCount} job{todayCount !== 1 ? "s" : ""} today
              </p>
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold text-[#5c5c5e] uppercase">Hired</p>
            <p className="text-[13px] text-[#1c1c1e] mt-0.5">{employee.hiredDate}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex flex-col gap-2">
        <Link
          href={`/admin/employees/${employee.id}`}
          className="flex h-9 w-full items-center justify-center rounded-lg border border-[#e2e8e6] bg-white px-3 text-[13px] font-medium text-primary hover:bg-[#eef1ef] transition-colors"
        >
          View Schedule<span className="sr-only"> for {employee.name}</span>
        </Link>
        <ArchiveButton employeeId={employee.id} employeeName={employee.name} archived={archived} />
      </div>
    </div>
  );
}

function ViewTab({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
        current ? "bg-primary text-white" : "border border-[#e2e8e6] bg-white text-[#5c5c5e] hover:bg-[#eef1ef]"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[] }>;
} = {}) {
  const [employees, todayJobs] = await Promise.all([getEmployees(), getTodayJobs()]);
  const showArchived = (await searchParams)?.view === "archived";

  const activeEmployees = employees.ok ? employees.data.filter((e) => e.archivedAt === null) : [];
  const archivedEmployees = employees.ok ? employees.data.filter((e) => e.archivedAt !== null) : [];
  const shown = showArchived ? archivedEmployees : activeEmployees;

  const displayDate = formatNy(new Date(), {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <>
      {/* Header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8 justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">
            Employees
          </h1>
          <p className="text-xs text-[#5c5c5e]">Team Overview</p>
        </div>
        <span className="text-sm text-[#5c5c5e]">{displayDate}</span>
      </header>

      {/* Content */}
      {!employees.ok || !todayJobs.ok ? (
        <LoadError what="your team" />
      ) : (
      <div className="flex-1 overflow-auto bg-[#f7f9f8]">
        <div className="p-8">
          {/* Section header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-[17px] text-[#1c1c1e]">
              {showArchived ? "Archived Employees" : "Team Members"}
            </h2>
            <AddEmployeeButton />
          </div>

          <nav aria-label="Employee list" className="flex gap-2 mb-6">
            <ViewTab href="/admin/employees" current={!showArchived}>
              Active ({activeEmployees.length})
            </ViewTab>
            <ViewTab href="/admin/employees?view=archived" current={showArchived}>
              Archived ({archivedEmployees.length})
            </ViewTab>
          </nav>

          {shown.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#5c5c5e]">
              {showArchived ? "No archived employees." : "No active employees yet."}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              {shown.map((employee) => (
                <EmployeeCard key={employee.id} employee={employee} todayJobs={todayJobs.data} />
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </>
  );
}
