"use client";

import { use } from "react";
import Link from "next/link";
import {
  JOB_MAP,
  EMPLOYEE_MAP,
  DASHBOARD_STATUS,
  ACTIVITY_LOGS,
  MOCK_TODAY,
  type JobStatus,
} from "../../data/mock";

function formatDetailDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDetailTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatSubmitted(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = formatDetailTime(iso);
  return `${date} \u00B7 ${time}`;
}

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const job = JOB_MAP[id];

  const displayDate = new Date(`${MOCK_TODAY}T12:00:00`).toLocaleDateString(
    "en-US",
    { weekday: "short", month: "long", day: "numeric", year: "numeric" },
  );

  if (!job) {
    return (
      <>
        <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8">
          <h1 className="font-semibold text-lg text-[#1c1c1e]">Booking not found</h1>
        </header>
        <div className="flex-1 flex items-center justify-center bg-[#f7f9f8]">
          <div className="text-center">
            <p className="text-[#5c5c5e] mb-4">This booking does not exist.</p>
            <Link href="/admin/bookings" className="text-[#1a6b5a] font-medium hover:underline">
              &larr; Back to Bookings
            </Link>
          </div>
        </div>
      </>
    );
  }

  const cfg = DASHBOARD_STATUS[job.status];
  const employees = job.employeeIds.map((eid) => EMPLOYEE_MAP[eid]);
  const employeeLabel = employees.length > 0
    ? employees.map((e) => e.name).join(", ")
    : "Unassigned";
  const activityLog = ACTIVITY_LOGS[job.id] ?? [];

  const subtitle = `${job.service} \u00B7 ${job.client} \u00B7 ${new Date(job.start).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;

  const detailRows = [
    { label: "Client", value: job.client },
    { label: "Email", value: job.email },
    { label: "Phone", value: job.phone },
    { label: "Service", value: job.frequency ? `${job.service} \u00B7 ${job.frequency}` : job.service },
    { label: "Address", value: job.address },
    { label: "Date", value: formatDetailDate(job.start) },
    { label: "Time Slot", value: `${formatDetailTime(job.start)} \u2013 ${formatDetailTime(job.end)}` },
    { label: "Property", value: job.property },
    { label: "Notes", value: job.notes },
    { label: "Submitted", value: job.submittedAt ? formatSubmitted(job.submittedAt) : undefined },
  ].filter((row) => row.value);

  return (
    <>
      {/* Header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8 justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">
            Booking #{job.bookingNumber}
          </h1>
          <p className="text-xs text-[#5c5c5e]">{subtitle}</p>
        </div>
        <span className="text-sm text-[#5c5c5e]">{displayDate}</span>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#f7f9f8]">
        <div className="p-8 flex gap-8">
          {/* Left column */}
          <div className="flex-1 min-w-0">
            {/* Details card */}
            <div className="bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
              <div className="px-8 py-6">
                <h2 className="font-semibold text-[17px] text-[#1c1c1e]">Booking Details</h2>
              </div>
              <div className="h-px bg-[#e2e8e6] mx-8" />

              {detailRows.map((row, i) => (
                <div key={row.label}>
                  <div className="flex px-8 py-3">
                    <span className="w-[200px] flex-shrink-0 text-[13px] text-[#5c5c5e]">
                      {row.label}
                    </span>
                    <span className="text-[13px] font-medium text-[#1c1c1e]">
                      {row.value}
                    </span>
                  </div>
                  {i < detailRows.length - 1 && <div className="h-px bg-[#e2e8e6] mx-8" />}
                </div>
              ))}
            </div>

            {/* Status banner */}
            <div
              className="mt-4 rounded-[10px] border px-6 py-3"
              style={{
                backgroundColor: job.status === "active" ? "#fef2e8"
                  : job.status === "done" ? "#e1f2e7"
                  : job.status === "confirmed" ? "#eaeefc"
                  : "#f7f9f8",
                borderColor: cfg.accentColor,
              }}
            >
              <p className="text-[11px] text-[#5c5c5e]">Current Status</p>
              <p className="text-[15px] font-semibold mt-0.5" style={{ color: cfg.accentColor }}>
                {cfg.label} {employees.length > 0 ? `\u00B7 Employee: ${employeeLabel}` : ""}
              </p>
            </div>
          </div>

          {/* Right column */}
          <div className="w-[380px] flex-shrink-0 flex flex-col gap-4">
            {/* Actions card */}
            <div className="bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
              <div className="px-6 py-5">
                <h2 className="font-semibold text-[17px] text-[#1c1c1e]">Actions</h2>
              </div>
              <div className="h-px bg-[#e2e8e6] mx-6" />
              <div className="px-6 py-4 flex flex-col gap-2.5">
                <button className="h-9 w-full rounded-lg bg-[#1a6b5a] text-white text-[13px] font-semibold hover:bg-[#155a4b] transition-colors">
                  Assign Employee
                </button>
                <button className="h-9 w-full rounded-lg border border-[#e2e8e6] bg-[#f7f9f8] text-[#1c1c1e] text-[13px] font-semibold hover:bg-[#eef1ef] transition-colors">
                  Reschedule
                </button>
                <button className="h-9 w-full rounded-lg bg-[#15803d] text-white text-[13px] font-semibold hover:bg-[#116b33] transition-colors">
                  Mark Complete
                </button>
                <button className="h-9 w-full rounded-lg border border-[#e2e8e6] bg-[#feefee] text-[#c0392b] text-[13px] font-semibold hover:bg-[#fde2e0] transition-colors">
                  Cancel Booking
                </button>
                <button className="h-9 w-full rounded-lg border border-[#e2e8e6] bg-[#f7f9f8] text-[#1c1c1e] text-[13px] font-semibold hover:bg-[#eef1ef] transition-colors">
                  Send Client Message
                </button>
                <button className="h-9 w-full rounded-lg border border-[#e2e8e6] bg-[#f7f9f8] text-[#1c1c1e] text-[13px] font-semibold hover:bg-[#eef1ef] transition-colors">
                  Print / Export
                </button>
              </div>
            </div>

            {/* Activity log */}
            {activityLog.length > 0 && (
              <div className="bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
                <div className="px-6 py-5">
                  <h2 className="font-semibold text-[15px] text-[#1c1c1e]">Activity Log</h2>
                </div>
                <div className="h-px bg-[#e2e8e6] mx-6" />
                <div className="px-6 py-4">
                  {activityLog.map((entry, i) => (
                    <div key={i} className="relative pl-6">
                      {/* Dot */}
                      <div className="absolute left-0 top-1 w-2 h-2 rounded bg-[#1a6b5a]" />
                      {/* Connecting line */}
                      {i < activityLog.length - 1 && (
                        <div className="absolute left-[3px] top-[12px] w-0.5 h-9 bg-[#e2e8e6]" />
                      )}
                      <p className="text-[11px] text-[#5c5c5e]">{entry.timestamp}</p>
                      <p className="text-[12px] font-medium text-[#1c1c1e] mb-4">{entry.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
