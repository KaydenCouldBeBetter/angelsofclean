import { getEmployees, getJobs } from "@/lib/supabase/queries";
import { EMPLOYEE_STATUS_CONFIG, type Employee, type EmployeeStatus, type Job } from "../data/mock";

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
              <div className="w-10 h-10 rounded-full bg-[#1a6b5a] flex items-center justify-center">
                <span className="text-white font-bold text-sm">{employee.initials}</span>
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${cfg.dotColor}`}
              />
            </div>
            <p className="font-semibold text-[17px] text-[#1c1c1e] leading-tight">
              {employee.name}
            </p>
          </div>
          {/* Status chip */}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${cfg.chipBg} ${cfg.chipText}`}
          >
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#e2e8e6] mx-5" />

      {/* Details grid */}
      <div className="px-5 pt-3 pb-4">
        <div className="grid grid-cols-2 gap-y-3">
          <div>
            <p className="text-[11px] font-semibold text-[#9c9c9d] uppercase">Phone</p>
            <p className="text-[13px] text-[#1c1c1e] mt-0.5">{employee.phone}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#9c9c9d] uppercase">Today</p>
            <p className="text-[13px] text-[#1c1c1e] mt-0.5">
              {todayCount} job{todayCount !== 1 ? "s" : ""} today
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#9c9c9d] uppercase">Hired</p>
            <p className="text-[13px] text-[#1c1c1e] mt-0.5">{employee.hiredDate}</p>
          </div>
        </div>
      </div>

      {/* View Schedule button */}
      <div className="px-5 pb-5">
        <button className="w-full h-9 rounded-lg border border-[#e2e8e6] bg-[#f7f9f8] text-[13px] font-medium text-[#1c1c1e] hover:bg-[#eef1ef] transition-colors">
          View Schedule
        </button>
      </div>
    </div>
  );
}

export default async function AdminEmployeesPage() {
  const [employees, jobs] = await Promise.all([getEmployees(), getJobs()]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayJobs = jobs.filter((job) => job.start.startsWith(todayStr) && job.status !== "cancelled");

  const displayDate = new Date().toLocaleDateString(
    "en-US",
    { weekday: "short", month: "long", day: "numeric", year: "numeric" },
  );

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
      <div className="flex-1 overflow-auto bg-[#f7f9f8]">
        <div className="p-8">
          {/* Section header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-[17px] text-[#1c1c1e]">
              Team Members
            </h2>
            <button className="bg-[#1a6b5a] hover:bg-[#155a4b] text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors">
              + Add Employee
            </button>
          </div>

          {/* Employee cards grid */}
          {employees.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#5c5c5e]">
              No employees yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              {employees.map((employee) => (
                <EmployeeCard key={employee.id} employee={employee} todayJobs={todayJobs} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
