"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

// The red alert box shared by load failures and the "couldn't verify your
// sign-in" screen: icon and color together, never color alone.
export function ErrorAlert({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-[#c0392b] bg-[#feefee] px-6 py-5"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#c0392b]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1c1c1e]">{title}</p>
        <p className="mt-1 text-[13px] text-[#1c1c1e]">{message}</p>
      </div>
      {action}
    </div>
  );
}

// Fills a page's content area when its data failed to load, so an outage
// never reads as an empty schedule.
export default function LoadError({ what }: { what: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex-1 overflow-auto bg-[#f7f9f8]">
      <div className="p-8">
        <ErrorAlert
          title={`We couldn't load ${what}`}
          message="This is a problem reaching the database, not an empty list. Try again in a moment."
          action={
            <button
              onClick={() => startTransition(() => router.refresh())}
              disabled={isPending}
              className="h-9 flex-shrink-0 rounded-lg border border-[#c0392b] bg-white px-4 text-[13px] font-semibold text-[#c0392b] hover:bg-[#fde2e0] transition-colors disabled:opacity-50"
            >
              {isPending ? "Trying…" : "Try again"}
            </button>
          }
        />
      </div>
    </div>
  );
}
