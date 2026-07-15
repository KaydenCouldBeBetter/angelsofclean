"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import CommercialNav from "@/components/booking/CommercialNav";
import { Button } from "@/components/ui/button";
import { useBookingStore } from "@/store/bookingStore";

export default function CommercialError() {
  const router = useRouter();
  const { address, city, zip } = useBookingStore();

  return (
    <>
      <CommercialNav />

      <div className="max-w-sm mx-auto md:max-w-3xl px-4 pt-8 pb-12 md:pt-14 md:px-8">
        {/* Error header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="w-20 h-20 rounded-full border-2 border-red-200 flex items-center justify-center mb-4"
            role="img"
            aria-label="Outside service area"
          >
            <svg
              className="w-9 h-9 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 9v4m0 4h.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900">
            Outside our service area
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            We currently serve the greater Syracuse, NY area.
          </p>
        </div>

        {/* Address entered */}
        {address && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4">
            <p className="text-xs font-medium text-red-500 mb-1 uppercase tracking-wide">
              Address entered
            </p>
            <p className="text-sm text-red-900 font-semibold">
              {address}, {city} {zip}
            </p>
          </div>
        )}

        {/* Info banner */}
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 mb-8"
        >
          <span
            className="text-zinc-400 mt-0.5 text-base flex-shrink-0"
            aria-hidden="true"
          >
            ℹ️
          </span>
          <div>
            <p className="text-sm text-zinc-700">
              We don&apos;t currently serve this ZIP code. For a custom commercial
              quote outside our standard area, give us a call.
            </p>
            <p className="text-sm text-zinc-700 mt-2">
              <a
                href="tel:+13155550100"
                className="text-teal-600 font-medium hover:text-teal-700 transition-colors"
              >
                (315) 555-0100
              </a>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Button
            onClick={() => router.push("/commercial")}
            className="w-full md:w-auto md:px-8 h-14 text-base font-semibold"
          >
            Try a Different Address
          </Button>
          <Link
            href="/"
            className="text-sm text-teal-700 hover:text-teal-800 text-center md:text-left transition-colors"
          >
            ← Return to Homepage
          </Link>
        </div>
      </div>
    </>
  );
}
