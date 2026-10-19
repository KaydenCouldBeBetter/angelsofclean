"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { BUSINESS_PHONE } from "@/lib/constants";

interface ServiceUnavailableProps {
  // What was not sent, in the customer's words: "booking" or "request".
  subject: string;
  onRetry: () => void;
  retrying: boolean;
}

// The designed "Error — Global" screen (Figma 120:967) for when the database
// can't be reached on submit. It replaces the review content, so focus moves to
// its heading: the button the customer just pressed is gone.
export default function ServiceUnavailable({
  subject,
  onRetry,
  retrying,
}: ServiceUnavailableProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-10 text-center lg:max-w-md">
      <div
        aria-hidden="true"
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#c0392b] bg-[#fce8e8]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-9 w-9 text-[#c0392b]"
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
      </div>

      <div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold text-[#1c1c1e] focus:outline-none"
        >
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-[#5c5c5e]">
          We couldn&apos;t complete your request. This is usually temporary.
        </p>
      </div>

      <div className="w-full rounded-xl border border-[#e0e0e0] bg-[#f7ffff] p-4 text-left">
        <p className="text-[13px] font-medium text-[#1c1c1e]">What happened:</p>
        <p className="mt-1.5 text-[13px] text-[#5c5c5e]">
          We couldn&apos;t save your {subject} because our service is temporarily
          unavailable. Your {subject} was NOT submitted.
        </p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="h-14 w-full rounded-xl bg-[#1a6b5a] text-base font-semibold text-white transition-colors hover:bg-[#124d41] disabled:opacity-50"
      >
        {retrying ? "Trying…" : "Try Again"}
      </button>

      <Link
        href="/"
        className="inline-flex h-14 w-full items-center justify-center rounded-xl border border-[#e0e0e0] bg-white text-base font-medium text-[#5c5c5e] transition-colors hover:bg-zinc-50"
      >
        Return to Homepage
      </Link>

      <div className="w-full rounded-xl border border-[#e0e0e0] bg-[#f7ffff] p-4 text-left">
        <p className="text-sm font-semibold text-[#1c1c1e]">Need immediate help?</p>
        <p className="mt-1 text-sm text-[#5c5c5e]">
          Call us directly:{" "}
          <a
            href={BUSINESS_PHONE.tel}
            className="font-medium text-[#1a6b5a] underline underline-offset-2"
          >
            {BUSINESS_PHONE.display}
          </a>
        </p>
      </div>
    </div>
  );
}
