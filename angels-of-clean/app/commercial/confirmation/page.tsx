"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { Button } from "@/components/ui/button";

export default function CommercialConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteRef = searchParams.get("ref");
  const { email, businessName, reset, setSubmitting } = useBookingStore();

  useEffect(() => {
    if (!email) router.replace("/commercial");
    setSubmitting(false);
  }, [email, router, setSubmitting]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-center h-14 border-b border-zinc-100">
        <span className="font-semibold text-zinc-900">Angels of Clean</span>
      </div>

      <div className="flex flex-col items-center gap-6 px-4 pt-10 pb-10">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full border-2 border-teal-500 flex items-center justify-center" role="img" aria-label="Quote request received">
          <span className="text-3xl text-teal-600" aria-hidden="true">✓</span>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900">Quote requested!</h1>
          <p className="text-sm text-zinc-500 mt-1">
            We'll be in touch within 1 business day.
          </p>
        </div>

        {/* Detail card */}
        <div className="w-full rounded-xl border border-zinc-200 p-4 flex flex-col gap-1">
          {businessName && (
            <p className="font-semibold text-zinc-900">{businessName}</p>
          )}
          <p className="text-sm text-zinc-500">Confirmation sent to {email}</p>
          {quoteRef && (
            <p className="text-sm text-zinc-400 mt-1">Quote ref: {quoteRef}</p>
          )}
        </div>

        {/* What to expect */}
        <div className="w-full rounded-xl border border-teal-100 bg-teal-50 p-4 flex flex-col gap-1">
          <p className="font-semibold text-zinc-900">What happens next?</p>
          <p className="text-sm text-zinc-500 mt-1">
            One of our commercial cleaning specialists will review your request and contact you with a custom quote.
          </p>
        </div>

        {/* Return home */}
        <Button
          variant="outline"
          className="w-full h-14"
          onClick={() => {
            reset();
            router.push("/");
          }}
        >
          Return to Home
        </Button>
      </div>
    </>
  );
}
