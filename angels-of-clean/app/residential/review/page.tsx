"use client";

import WhatHappensNext from "@/components/booking/WhatHappensNext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { AgreementNote } from "@/components/booking/PolicyNotes";
import SubmitErrorAlert from "@/components/booking/SubmitErrorAlert";
import ServiceUnavailable from "@/components/booking/ServiceUnavailable";
import { useBookingStore, useBookingHydrated } from "@/store/bookingStore";
import { SERVICE_LABELS, FREQUENCY_LABELS, TIME_LABELS, PRICE_NOTE } from "@/lib/constants";
import { submitBooking, type BookingResult } from "@/app/actions/submitBooking";

export default function ReviewPage() {
  const router = useRouter();
  const store = useBookingStore();
  const hydrated = useBookingHydrated();
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const {
    service, frequency,
    address, city, zip,
    bedrooms, bathrooms, notes, accessInstructions,
    date, timeSlot,
    name, email, phone,
    formStartedAt, honeypot,
    dateExpired,
    isSubmitting, setSubmitting,
  } = store;

  useEffect(() => {
    // Wait for the store to fill from sessionStorage: until then it reads as empty.
    if (!hydrated) return;
    // A saved date that had passed was cleared on load: send the customer to
    // the date step (which explains why) instead of back to the start.
    if (dateExpired) router.replace("/residential/datetime?returnTo=review");
    // No start time means the wizard state predates the bot check: start over.
    else if (!service || !address || !date || !name || formStartedAt === null) {
      router.replace("/residential");
    }
  }, [hydrated, service, address, date, name, formStartedAt, dateExpired, router]);

  const formattedDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "";

  async function handleConfirm() {
    if (isSubmitting) return;
    // Any earlier error stays on screen while this attempt runs, so the retry
    // button the customer just pressed doesn't vanish under them.
    setSubmitting(true);

    let result: BookingResult;
    try {
      result = await submitBooking({
        service: service ?? "",
        frequency: frequency ?? "",
        address, city, zip,
        bedrooms, bathrooms, notes, accessInstructions,
        date,
        timeSlot: timeSlot ?? "",
        name, email, phone,
      }, {
        website: honeypot,
        elapsedMs: Date.now() - (formStartedAt ?? Date.now()),
      });
    } catch {
      // The request never reached the server (offline, timeout).
      result = {
        success: false,
        error: "We couldn't send your booking. Check your connection and try again.",
      };
    }

    if (!result.success || !result.bookingRef) {
      setSubmitting(false);
      setUnavailable(result.unavailable === true);
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(`/residential/confirmation?ref=${result.bookingRef}`);
  }

  if (unavailable) {
    return (
      <ServiceUnavailable subject="booking" onRetry={handleConfirm} retrying={isSubmitting} />
    );
  }

  const reviewCards = [
    {
      label: "Service",
      editHref: "/residential?returnTo=review",
      lines: [
        service ? SERVICE_LABELS[service] : "\u2014",
        frequency ? FREQUENCY_LABELS[frequency] : "\u2014",
      ],
    },
    {
      label: "Address",
      editHref: "/residential/address?returnTo=review",
      lines: [
        address || "\u2014",
        `${city}, NY ${zip}`,
      ],
    },
    {
      label: "Property Details",
      editHref: "/residential/property?returnTo=review",
      lines: [
        `${bedrooms} ${bedrooms === 1 ? "Bedroom" : "Bedrooms"}, ${bathrooms} ${bathrooms === 1 ? "Bathroom" : "Bathrooms"}`,
        notes ? `Notes: ${notes}` : null,
        accessInstructions ? `Entry instructions: ${accessInstructions}` : null,
      ].filter(Boolean) as string[],
    },
    {
      label: "Date & Time",
      editHref: "/residential/datetime?returnTo=review",
      lines: [
        formattedDate,
        timeSlot ? TIME_LABELS[timeSlot] : "\u2014",
      ],
    },
    {
      label: "Contact Information",
      editHref: "/residential/contact?returnTo=review",
      lines: [
        name || "\u2014",
        [email, phone].filter(Boolean).join(" \u00B7 "),
      ],
    },
  ];

  return (
    <>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <StepHeader step={6} totalSteps={6} backHref="/residential/contact" />
        <ProgressDots currentStep={6} totalSteps={6} />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4 pb-32 lg:px-0 lg:pb-0">
        <div className="mb-1">
          <h1 className="text-2xl font-bold leading-tight lg:text-3xl">
            Review Your Booking
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Please confirm everything looks correct before submitting.
          </p>
        </div>

        {/* Mobile: stacked cards */}
        <div className="flex flex-col gap-3 lg:hidden">
          {reviewCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 uppercase tracking-wide">{card.label}</span>
                <Link href={card.editHref} className="text-sm text-primary font-medium hover:underline">Edit</Link>
              </div>
              {card.lines.map((line, i) => (
                <p key={i} className={i === 0 ? "mt-1 font-semibold text-zinc-900" : "text-sm text-zinc-500"}>
                  {line}
                </p>
              ))}
            </div>
          ))}

          {/* Price note — mobile */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-medium text-primary">{PRICE_NOTE}</p>
          </div>
        </div>

        {/* Desktop: 2-column grid */}
        <div className="hidden lg:grid grid-cols-2 gap-4">
          {reviewCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500">{card.label}</span>
                <Link href={card.editHref} className="text-sm text-primary font-medium hover:underline">Edit</Link>
              </div>
              {card.lines.map((line, i) => (
                <p key={i} className={i === 0 ? "font-semibold text-zinc-900" : "text-sm text-zinc-500 mt-0.5"}>
                  {line}
                </p>
              ))}
            </div>
          ))}

          {/* Price note — desktop (teal background) */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-5">
            <p className="text-sm font-medium text-primary">{PRICE_NOTE}</p>
          </div>
        </div>

        <WhatHappensNext />

        {error && (
          <SubmitErrorAlert
            title="Your booking was not sent"
            message={error}
            onRetry={handleConfirm}
            retrying={isSubmitting}
          />
        )}

        <AgreementNote action="Confirm Booking" />

        {/* Desktop: full-width confirm button */}
        <div className="hidden lg:block mt-4">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full h-14 rounded-xl bg-primary text-white text-base font-semibold hover:bg-primary-pressed transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Submitting\u2026" : "Confirm Booking"}
          </button>
          <div className="mt-3 text-center">
            <Link href="/residential/contact" className="text-sm font-medium text-primary hover:underline">
              &larr; Back
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile fixed CTA */}
      <div className="lg:hidden">
        <BottomCTA label={isSubmitting ? "Submitting\u2026" : "Confirm Booking"} onClick={handleConfirm} disabled={isSubmitting} />
      </div>
    </>
  );
}
