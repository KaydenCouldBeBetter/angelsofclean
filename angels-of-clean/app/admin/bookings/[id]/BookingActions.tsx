"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignEmployees, confirmBooking, updateBookingStatus } from "../../actions";
import type { Employee, Job } from "@/lib/admin-types";

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
  // Overlapping jobs for newly ticked cleaners, shown before "Assign Anyway".
  const [conflicts, setConflicts] = useState<string[] | null>(null);

  const isUnconfirmed = job.status === "pending";
  const isCancelled = job.status === "cancelled";
  const isDone = job.status === "done";

  function toggleEmployee(id: string) {
    // The warning only describes the selection it was shown for.
    setConflicts(null);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    );
  }

  function openPicker() {
    // Start from the current crew; it may have changed since the last open.
    setSelectedIds(job.employeeIds);
    setConflicts(null);
    setError(null);
    setShowPicker(true);
  }

  function closePicker() {
    setShowPicker(false);
    setConflicts(null);
  }

  function handleSaveAssignment(allowOverlap: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await assignEmployees(job.id, selectedIds, job.employeeIds, { allowOverlap });
      if (result.success) {
        closePicker();
        router.refresh();
      } else if (result.conflicts) {
        setConflicts(result.conflicts);
      } else {
        // Stale crew or a closed booking: close the picker so reopening it
        // starts from what the job looks like now.
        setError(result.error);
        closePicker();
        router.refresh();
      }
    });
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmBooking(job.id);
      if (!result.success) setError(result.error ?? "Something went wrong.");
      // Refresh either way: a refusal means the status changed under us.
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
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

      {isUnconfirmed && (
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="h-9 w-full rounded-lg bg-[#1d4ed8] text-white text-[13px] font-semibold hover:bg-[#1e40af] transition-colors disabled:opacity-50"
        >
          Confirm Booking
        </button>
      )}

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
          {conflicts && (
            <div role="alert" className="rounded-lg bg-[#fef3c7] p-2.5 text-xs text-[#92400e]">
              <p className="font-semibold">Schedule overlap</p>
              <ul className="mt-1 list-disc pl-4">
                {conflicts.map((line) => <li key={line}>{line}</li>)}
              </ul>
              <p className="mt-1">Assign anyway, or change who&apos;s selected.</p>
            </div>
          )}
          <div className="flex gap-2 mt-1">
            {conflicts ? (
              <button
                onClick={() => handleSaveAssignment(true)}
                disabled={isPending}
                className="h-8 flex-1 rounded-lg bg-[#b45309] text-white text-[13px] font-semibold hover:bg-[#92400e] transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Assign Anyway"}
              </button>
            ) : (
              <button
                onClick={() => handleSaveAssignment(false)}
                disabled={isPending}
                className="h-8 flex-1 rounded-lg bg-[#1a6b5a] text-white text-[13px] font-semibold hover:bg-[#155a4b] transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save Assignment"}
              </button>
            )}
            <button
              onClick={closePicker}
              className="h-8 px-3 rounded-lg border border-[#e2e8e6] text-[#1c1c1e] text-[13px] font-medium hover:bg-[#eef1ef] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={openPicker}
          disabled={isCancelled || isDone}
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
