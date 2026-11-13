"use client";

import { useState, useTransition } from "react";
import { setEmployeeArchived } from "./actions";

interface ArchiveButtonProps {
  employeeId: string;
  employeeName: string;
  archived: boolean;
}

const SECONDARY =
  "h-9 rounded-lg border border-[#e2e8e6] bg-white px-3 text-[13px] font-medium text-primary hover:bg-[#eef1ef] transition-colors disabled:opacity-50";

// Archive (asks first, since it takes the person off the crew lists) or, for an
// archived employee, Reactivate (one click: nothing is lost by undoing it).
export default function ArchiveButton({ employeeId, employeeName, archived }: ArchiveButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setEmployeeArchived(employeeId, next);
      if (result.success) setConfirming(false);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-lg border border-[#c0392b] bg-[#feefee] px-3 py-2 text-xs text-[#1c1c1e]">
          {error}
        </p>
      )}

      {archived ? (
        <button type="button" onClick={() => run(false)} disabled={isPending} className={SECONDARY}>
          {isPending ? "Reactivating..." : `Reactivate ${employeeName}`}
        </button>
      ) : confirming ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[#e2e8e6] p-3">
          <p className="text-xs text-[#1c1c1e]">
            Archive {employeeName}? They stay in your records but can&apos;t be assigned to new jobs.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => run(true)}
              disabled={isPending}
              className="h-9 flex-1 rounded-lg border border-[#c0392b] bg-white text-[13px] font-semibold text-[#c0392b] hover:bg-[#feefee] transition-colors disabled:opacity-50"
            >
              {isPending ? "Archiving..." : "Archive"}
            </button>
            <button type="button" onClick={() => { setConfirming(false); setError(null); }} disabled={isPending} className={`${SECONDARY} flex-1`}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={SECONDARY}>
          Archive {employeeName}
        </button>
      )}
    </div>
  );
}
