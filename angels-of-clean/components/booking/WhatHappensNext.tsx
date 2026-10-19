import { BUSINESS_PHONE } from "@/lib/constants";

// Shown on Review and Confirmation in both flows (backlog B28). No prices are
// shown while booking; the office confirms the price afterwards.
export default function WhatHappensNext({ className = "" }: { className?: string }) {
  return (
    <section
      aria-label="What happens next"
      data-testid="what-happens-next"
      className={`rounded-xl border border-zinc-200 p-4 md:p-5 ${className}`}
    >
      <h2 className="text-sm font-semibold text-zinc-900 mb-3">
        What happens next
      </h2>
      <ol className="flex flex-col gap-3">
        <li className="flex items-start gap-3 text-sm text-zinc-600">
          <StepNumber n={1} />
          We review your request and confirm the price and time with you, by phone or email.
        </li>
        <li className="flex items-start gap-3 text-sm text-zinc-600">
          <StepNumber n={2} />
          No payment is taken online.
        </li>
        <li className="flex items-start gap-3 text-sm text-zinc-600">
          <StepNumber n={3} />
          <span>
            To cancel or change your request, call us at{" "}
            <a
              href={BUSINESS_PHONE.tel}
              className="font-medium text-primary underline underline-offset-2"
            >
              {BUSINESS_PHONE.display}
            </a>
            .
          </span>
        </li>
      </ol>
    </section>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold flex-shrink-0 flex items-center justify-center mt-0.5"
    >
      {n}
    </span>
  );
}
