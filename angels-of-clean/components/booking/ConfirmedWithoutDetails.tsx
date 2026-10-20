import Link from "next/link";
import WhatHappensNext from "@/components/booking/WhatHappensNext";

interface ConfirmedWithoutDetailsProps {
  title: string;
  reference: string;
}

// Shown when a confirmation page is reloaded: the details were cleared from
// this browser after the first view, but the reference is still in the URL.
// The next steps and the phone number stay, since they're what a customer who
// comes back to this page needs.
export default function ConfirmedWithoutDetails({
  title,
  reference,
}: ConfirmedWithoutDetailsProps) {
  return (
    <div className="max-w-sm mx-auto px-4 py-16 flex flex-col items-center text-center gap-4">
      <div
        className="w-20 h-20 rounded-full bg-primary flex items-center justify-center"
        role="img"
        aria-label={title}
      >
        <span className="text-3xl text-white" aria-hidden="true">&#10003;</span>
      </div>
      <h1 className="text-3xl font-bold text-zinc-900">{title}</h1>
      <p className="text-base font-semibold text-zinc-900">
        Reference number: {reference}
      </p>
      <p className="text-sm text-zinc-500">
        For your privacy, the details you entered are no longer stored in this browser. Keep
        this number for your records.
      </p>
      <WhatHappensNext className="w-full text-left" />
      <Link
        href="/"
        className="mt-2 inline-flex h-12 items-center rounded-lg border border-zinc-300 px-6 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
      >
        Return to Home
      </Link>
    </div>
  );
}
