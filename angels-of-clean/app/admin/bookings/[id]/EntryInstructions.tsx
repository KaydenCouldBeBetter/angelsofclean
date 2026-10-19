"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { updateEntryInstructions } from "./actions";

interface EntryInstructionsProps {
  bookingId: string;
  // null when none were given.
  instructions: string | null;
  // The lookup failed: show that, and don't offer an edit that could
  // overwrite instructions we couldn't read.
  loadFailed?: boolean;
}

// Door code, gate, pets. Stored in booking_access and shown only here.
export default function EntryInstructions({
  bookingId,
  instructions,
  loadFailed = false,
}: EntryInstructionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(instructions ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEditing() {
    setDraft(instructions ?? "");
    setError(null);
    setEditing(true);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateEntryInstructions(bookingId, draft);
      if (result.success) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="mt-4 bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
      <div className="px-8 py-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-[17px] text-[#1c1c1e]">Entry Instructions</h2>
          <p className="text-xs text-[#5c5c5e] mt-0.5">
            Door code, gate, pets. Admins only; never shown in lists or the calendar.
          </p>
        </div>
        {!editing && !loadFailed && (
          <button
            type="button"
            onClick={startEditing}
            className="h-9 px-4 flex-shrink-0 rounded-lg border border-[#e2e8e6] text-primary text-[13px] font-semibold hover:bg-[#eef1ef] transition-colors"
          >
            {instructions ? "Edit" : "Add"}
            <span className="sr-only"> entry instructions</span>
          </button>
        )}
      </div>
      <div className="h-px bg-[#e2e8e6] mx-8" />

      <div className="px-8 py-4">
        {loadFailed ? (
          <p className="text-[13px] text-[#c0392b]">
            Entry instructions couldn&apos;t be loaded. Refresh the page to try again.
          </p>
        ) : editing ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="entry-instructions" className="text-[13px] font-medium text-[#1c1c1e]">
              Entry instructions
            </label>
            <textarea
              id="entry-instructions"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={FIELD_MAX_LENGTHS.accessInstructions}
              autoComplete="off"
              spellCheck={false}
              rows={3}
              className="w-full rounded-lg border border-zinc-500 px-3 py-2 text-[13px] text-[#1c1c1e]"
            />
            <p className="text-xs text-[#5c5c5e]">Leave blank and save to remove them.</p>
            {error && <p role="alert" className="text-xs text-[#c0392b]">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="h-9 px-4 rounded-lg bg-primary text-white text-[13px] font-semibold hover:bg-primary-pressed transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={isPending}
                className="h-9 px-4 rounded-lg border border-[#e2e8e6] text-[#1c1c1e] text-[13px] font-medium hover:bg-[#eef1ef] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : instructions ? (
          <p className="text-[13px] font-medium text-[#1c1c1e] whitespace-pre-wrap break-words">
            {instructions}
          </p>
        ) : (
          <p className="text-[13px] text-[#5c5c5e]">None given.</p>
        )}
      </div>
    </div>
  );
}
