"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { SERVICE_LABELS, FREQUENCY_LABELS, TIME_LABELS } from "@/lib/constants";

export default function ReviewPage() {
  const router = useRouter();
  const store = useBookingStore();

  const {
    service, frequency,
    address, city, zip,
    bedrooms, bathrooms, notes,
    date, timeSlot,
    name, email, phone,
    isSubmitting, setSubmitting,
  } = store;

  useEffect(() => {
    if (!service || !address || !date || !name) router.replace("/residential");
  }, [service, address, date, name, router]);

  const formattedDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "";

  function handleConfirm() {
    if (isSubmitting) return;
    setSubmitting(true);
    router.push("/residential/confirmation");
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
        `${bedrooms} Bedrooms, ${bathrooms} Bathroom`,
        notes ? `Notes: ${notes}` : null,
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
                <span className="text-xs text-zinc-400 uppercase tracking-wide">{card.label}</span>
                <Link href={card.editHref} className="text-sm text-teal-600 font-medium">Edit</Link>
              </div>
              {card.lines.map((line, i) => (
                <p key={i} className={i === 0 ? "mt-1 font-semibold text-zinc-900" : "text-sm text-zinc-500"}>
                  {line}
                </p>
              ))}
            </div>
          ))}

          {/* Price card — mobile */}
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-xs text-zinc-400">Estimated Price</p>
            <p className="font-semibold text-[#1a6b5a] mt-1">Quote provided after confirmation</p>
          </div>
        </div>

        {/* Desktop: 2-column grid */}
        <div className="hidden lg:grid grid-cols-2 gap-4">
          {reviewCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">{card.label}</span>
                <Link href={card.editHref} className="text-sm text-[#1a6b5a] font-medium hover:underline">Edit</Link>
              </div>
              {card.lines.map((line, i) => (
                <p key={i} className={i === 0 ? "font-semibold text-zinc-900" : "text-sm text-zinc-500 mt-0.5"}>
                  {line}
                </p>
              ))}
            </div>
          ))}

          {/* Price card — desktop (teal background) */}
          <div className="rounded-xl bg-teal-50 border border-teal-100 p-5">
            <p className="text-xs text-zinc-400">Estimated Price</p>
            <p className="font-semibold text-[#1a6b5a] mt-2">Quote provided after confirmation</p>
          </div>
        </div>

        {/* Desktop: full-width confirm button */}
        <div className="hidden lg:block mt-4">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full h-14 rounded-xl bg-[#1a6b5a] text-white text-base font-semibold hover:bg-[#155a4b] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Submitting\u2026" : "Confirm Booking"}
          </button>
          <div className="mt-3 text-center">
            <Link href="/residential/contact" className="text-sm font-medium text-[#1a6b5a] hover:underline">
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
