"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignEmployees, updateBookingStatus } from "../../actions";
import type { Employee, Job } from "../../data/mock";

interface BookingActionsProps {
  job: Job;
  employees: Employee[];
}

export default function BookingActions({ job, employees }: BookingActionsProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(job.employeeIds);
  const [showPicker, setShowPicker] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isCancelled = job.status === "cancelled";
  const isDone = job.status === "done";

  function toggleEmployee(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    );
  }

  function handleSaveAssignment() {
    setError(null);
    startTransition(async () => {
      const result = await assignEmployees(job.id, selectedIds);
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setShowPicker(false);
      router.refresh();
    });
  }

  function handleMarkComplete() {
    setError(null);
    startTransition(async () => {
      const result = await updateBookingStatus(job.id, "done");
      if (!result.success) setError(result.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  function handleCancel() {
    if (!confirm("Cancel this booking? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await updateBookingStatus(job.id, "cancelled");
      if (!result.success) setError(result.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {showPicker ? (
        <div className="rounded-lg border border-[#e2e8e6] p-3 flex flex-col gap-2">
          {employees.map((emp) => (
            <label key={emp.id} className="flex items-center gap-2 text-[13px] text-[#1c1c1e]">
              <input
                type="checkbox"
                checked={selectedIds.includes(emp.id)}
                onChange={() => toggleEmployee(emp.id)}
              />
              {emp.name}
            </label>
          ))}
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleSaveAssignment}
              disabled={isPending}
              className="h-8 flex-1 rounded-lg bg-[#1a6b5a] text-white text-[13px] font-semibold hover:bg-[#155a4b] transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save Assignment"}
            </button>
            <button
              onClick={() => { setShowPicker(false); setSelectedIds(job.employeeIds); }}
              className="h-8 px-3 rounded-lg border border-[#e2e8e6] text-[#1c1c1e] text-[13px] font-medium hover:bg-[#eef1ef] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowPicker(true)}
          disabled={isCancelled}
          className="h-9 w-full rounded-lg bg-[#1a6b5a] text-white text-[13px] font-semibold hover:bg-[#155a4b] transition-colors disabled:opacity-50"
        >
          Assign Employee
        </button>
      )}

      <button className="h-9 w-full rounded-lg border border-[#e2e8e6] bg-[#f7f9f8] text-[#1c1c1e] text-[13px] font-semibold hover:bg-[#eef1ef] transition-colors">
        Reschedule
      </button>

      <button
        onClick={handleMarkComplete}
        disabled={isPending || isCancelled || isDone}
        className="h-9 w-full rounded-lg bg-[#15803d] text-white text-[13px] font-semibold hover:bg-[#116b33] transition-colors disabled:opacity-50"
      >
        Mark Complete
      </button>

      <button
        onClick={handleCancel}
        disabled={isPending || isCancelled}
        className="h-9 w-full rounded-lg border border-[#e2e8e6] bg-[#feefee] text-[#c0392b] text-[13px] font-semibold hover:bg-[#fde2e0] transition-colors disabled:opacity-50"
      >
        Cancel Booking
      </button>

      <button className="h-9 w-full rounded-lg border border-[#e2e8e6] bg-[#f7f9f8] text-[#1c1c1e] text-[13px] font-semibold hover:bg-[#eef1ef] transition-colors">
        Send Client Message
      </button>
      <button className="h-9 w-full rounded-lg border border-[#e2e8e6] bg-[#f7f9f8] text-[#1c1c1e] text-[13px] font-semibold hover:bg-[#eef1ef] transition-colors">
        Print / Export
      </button>
    </div>
  );
}
