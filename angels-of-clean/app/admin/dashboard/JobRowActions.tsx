"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmBooking } from "../actions";
import type { JobStatus } from "@/lib/admin-types";

interface JobRowActionsProps {
  jobId: string;
  client: string;
  status: JobStatus;
}

export default function JobRowActions({ jobId, client, status }: JobRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmBooking(jobId);
      if (!result.success) setError(result.error ?? "Something went wrong.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {status === "pending" && (
          <button
            onClick={handleConfirm}
            disabled={isPending}
            aria-label={`Confirm booking for ${client}`}
            className="bg-[#1d4ed8] text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-[#1e40af] transition-colors disabled:opacity-50"
          >
            Confirm
          </button>
        )}
        <Link
          href={`/admin/bookings/${jobId}`}
          className="bg-[#f7f9f8] border border-[#e2e8e6] text-[#1c1c1e] text-xs font-medium px-4 py-1.5 rounded-md hover:bg-[#eef1ef] transition-colors"
        >
          View
        </Link>
      </div>
      {/* Outlives the Confirm button, so a refusal still explains the new status. */}
      {error && (
        <p role="alert" className="text-xs text-right text-[#c0392b]">
          {error}
        </p>
      )}
    </div>
  );
}
