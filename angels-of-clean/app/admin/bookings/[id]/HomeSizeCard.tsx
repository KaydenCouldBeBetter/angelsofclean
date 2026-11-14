"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HOME_SIZE_OPTIONS, homeSizeLabel, isHomeSize, type HomeSize } from "@/lib/home-size";
import { updateHomeSize } from "./actions";

interface HomeSizeCardProps {
  bookingId: string;
  // null for a booking made before size was asked.
  homeSize: HomeSize | null;
  // False once the booking is finished or cancelled: changing its size would
  // only rewrite history.
  editable: boolean;
}

// About how big the home is, as the customer or the office gave it. The crew
// limit counts homes by size, so the office corrects it here (a customer who
// said "Not sure" is counted as a large home until then).
export default function HomeSizeCard({ bookingId, homeSize, editable }: HomeSizeCardProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<string>(homeSize ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectId = useId();

  const changed = isHomeSize(draft) && draft !== homeSize;

  function handleSave() {
    if (!isHomeSize(draft)) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateHomeSize(bookingId, draft);
      if (result.success) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="mt-4 bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
      <div className="px-8 py-5">
        <h2 className="font-semibold text-[17px] text-[#1c1c1e]">Home size</h2>
        <p className="text-xs text-[#5c5c5e] mt-0.5">
          Used to plan crews and time. &ldquo;Not sure&rdquo; counts as a large home.
        </p>
      </div>
      <div className="h-px bg-[#e2e8e6] mx-8" />

      <div className="px-8 py-4">
        {editable ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <label htmlFor={selectId} className="mb-1 block text-[13px] font-medium text-[#1c1c1e]">
                About how big is the home?
              </label>
              <select
                id={selectId}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setSaved(false);
                  setError(null);
                }}
                className="h-10 w-full rounded-lg border border-[#767676] bg-white px-3 text-[13px] text-[#1c1c1e]"
              >
                {homeSize === null && (
                  <option value="" disabled>
                    {homeSizeLabel(null)}
                  </option>
                )}
                {HOME_SIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !changed}
              className="h-10 px-4 rounded-lg bg-primary text-white text-[13px] font-semibold hover:bg-primary-pressed transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <p className="text-[13px] font-medium text-[#1c1c1e]">
            {homeSizeLabel(homeSize)}
            <span className="font-normal text-[#5c5c5e]"> · can&apos;t be changed on a finished or cancelled booking</span>
          </p>
        )}
        {/* Always in the page, so a screen reader announces the text when it appears. */}
        <p role="status" className="mt-2 text-[13px] text-primary-pressed">
          {saved ? "Saved." : ""}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-[#c0392b]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
