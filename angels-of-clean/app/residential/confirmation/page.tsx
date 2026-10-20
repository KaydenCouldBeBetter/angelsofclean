"use client";

import WhatHappensNext from "@/components/booking/WhatHappensNext";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar-links";
import { isValidDateStr } from "@/lib/datetime";
import { formatBookingDate } from "@/lib/booking-date";
import ConfirmedWithoutDetails from "@/components/booking/ConfirmedWithoutDetails";
import ComingSoonButton from "@/components/booking/ComingSoonButton";
import {
  SERVICE_LABELS,
  FREQUENCY_LABELS,
  TIME_LABELS,
  PRICE_NOTE,
  formatBathroomCount,
  parseBookingRef,
} from "@/lib/constants";
import { useIsClient } from "@/lib/use-is-client";

function downloadIcs(event: CalendarEvent) {
  const url = URL.createObjectURL(new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "angels-of-clean-booking.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// A booking is a request until the office confirms it, and no email is sent
// yet (backlog B17), so this page must not say "confirmed" or "booked".
const REQUEST_RECEIVED = "Booking request received";
const REQUEST_NEXT = "We'll review your request and confirm the time and price with you.";

function CalendarButtons({
  event,
  className,
  buttonClassName,
}: {
  event: CalendarEvent;
  className: string;
  buttonClassName: string;
}) {
  return (
    <div className={className}>
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline" }), buttonClassName)}
      >
        Add to Google Calendar<span className="sr-only"> (opens in a new tab)</span>
      </a>
      <Button variant="outline" className={buttonClassName} onClick={() => downloadIcs(event)}>
        Add to Apple Calendar
      </Button>
    </div>
  );
}

export default function ConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only a reference in the shape the server issues; anything else in the URL
  // is treated as no reference.
  const bookingRef = parseBookingRef(searchParams.get("ref"));
  const isClient = useIsClient();

  // Keep a private copy of what this page shows, then clear the booking from
  // the browser (store and sessionStorage). Otherwise the address, phone, and
  // notes stay there, and Back refills the form, until the tab is closed.
  const [booking] = useState(() => useBookingStore.getState());
  const {
    service, frequency, date, timeSlot,
    address, city, zip,
    bedrooms, bathrooms,
    email,
  } = booking;
  const hasDetails = Boolean(service && email);

  useEffect(() => {
    useBookingStore.getState().reset();
  }, []);

  useEffect(() => {
    // No booking and no reference: this page wasn't reached by booking.
    if (!hasDetails && !bookingRef) router.replace("/residential");
  }, [hasDetails, bookingRef, router]);

  // The details only ever exist in this browser, so there's nothing to render
  // on the server.
  if (!isClient) return null;

  if (!hasDetails) {
    return bookingRef ? (
      <ConfirmedWithoutDetails title={REQUEST_RECEIVED} reference={bookingRef} />
    ) : null;
  }

  const formattedDate = formatBookingDate(date, "long");

  const serviceLabel = `${SERVICE_LABELS[service ?? "standard"]} · ${FREQUENCY_LABELS[frequency ?? "one-time"]}`;
  const timeLabel = timeSlot ? TIME_LABELS[timeSlot] : "";
  const propertyLabel = `${bedrooms} ${bedrooms === 1 ? "Bedroom" : "Bedrooms"} · ${formatBathroomCount(bathrooms)}`;

  const calendarEvent: CalendarEvent | null =
    timeSlot && isValidDateStr(date)
      ? {
          title: `Angels of Clean: ${SERVICE_LABELS[service ?? "standard"]}`,
          date,
          timeSlot,
          location: `${address}, ${city}, NY ${zip}`,
          description: `${serviceLabel}${bookingRef ? `\nReference number: ${bookingRef}` : ""}`,
          uid: `${bookingRef ?? `${date}-${timeSlot}`}@angelsofclean`,
        }
      : null;

  return (
    <>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        {/* Header */}
        <div className="flex items-center justify-center h-14 border-b border-zinc-100">
          <span className="font-semibold text-zinc-900">Angels of Clean</span>
        </div>

        <div className="flex flex-col items-center gap-6 px-4 pt-10 pb-10">
          {/* Success icon */}
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center" role="img" aria-label={REQUEST_RECEIVED}>
            <span className="text-3xl text-white" aria-hidden="true">&#10003;</span>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-zinc-900">{REQUEST_RECEIVED}</h1>
            <p className="text-sm text-zinc-500 mt-1">{REQUEST_NEXT}</p>
          </div>

          {/* Booking detail card */}
          <div className="w-full rounded-xl border border-zinc-200 p-4 flex flex-col gap-1">
            {bookingRef && (
              <p className="text-xs text-zinc-500 uppercase tracking-wide">
                Reference number: {bookingRef}
              </p>
            )}
            <p className="font-semibold text-zinc-900">{serviceLabel}</p>
            <p className="text-sm text-zinc-500">{formattedDate} · {timeLabel}</p>
            <p className="text-sm text-zinc-500">{address}, {city}, NY {zip}</p>
            <p className="text-sm text-zinc-500">{propertyLabel}</p>
          </div>

          <p className="w-full text-sm text-zinc-500">{PRICE_NOTE}</p>

          {/* Calendar buttons */}
          {calendarEvent && (
            <CalendarButtons
              event={calendarEvent}
              className="w-full flex flex-col gap-3"
              buttonClassName="w-full h-14"
            />
          )}

          <WhatHappensNext className="w-full" />

          <div className="w-full border-t border-zinc-100 pt-4">
            <div className="rounded-xl border border-zinc-200 p-4 flex flex-col gap-3">
              <p className="font-semibold text-zinc-900">Save your details for next time?</p>
              <p className="text-sm text-zinc-500">
                Create an account to pre-fill your info on future bookings.
              </p>
              <ComingSoonButton className="w-fit h-11">Create Account</ComingSoonButton>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-14"
            onClick={() => router.push("/")}
          >
            Return to Home
          </Button>
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:flex flex-col items-center py-10">
        {/* Success icon */}
        <div className="w-[120px] h-[120px] rounded-full bg-primary flex items-center justify-center mb-6" role="img" aria-label={REQUEST_RECEIVED}>
          <span className="text-5xl text-white" aria-hidden="true">&#10003;</span>
        </div>

        <h1 className="text-3xl font-bold text-zinc-900">{REQUEST_RECEIVED}</h1>
        <p className="text-base text-zinc-500 mt-2">{REQUEST_NEXT}</p>

        {/* Detail card */}
        <div className="w-[640px] mt-8 rounded-xl border border-zinc-200 bg-white p-6 flex flex-col gap-2">
          {bookingRef && (
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Reference number: {bookingRef}
            </p>
          )}
          <p className="font-semibold text-zinc-900">{serviceLabel}</p>
          <p className="text-sm text-zinc-500">{formattedDate} · {timeLabel}</p>
          <p className="text-sm text-zinc-500">{address}, {city}, NY {zip}</p>
          <p className="text-sm text-zinc-500">{propertyLabel}</p>
        </div>

        <p className="w-[640px] mt-4 text-sm text-zinc-500">{PRICE_NOTE}</p>

        {/* Calendar buttons — side by side */}
        {calendarEvent && (
          <CalendarButtons
            event={calendarEvent}
            className="w-[640px] mt-4 flex gap-4"
            buttonClassName="flex-1 h-12"
          />
        )}

        <WhatHappensNext className="w-[640px] mt-4" />

        {/* Upsell card */}
        <div className="w-[640px] mt-4 rounded-xl bg-primary/5 border border-primary/20 p-5">
          <p className="font-semibold text-zinc-900">Save your details for faster booking next time</p>
          <p className="text-sm text-zinc-500 mt-1">
            Create a free account &mdash; no password required during booking.
          </p>
          <ComingSoonButton className="mt-3 h-9">Create Account</ComingSoonButton>
        </div>

        {/* Return home */}
        <Button
          variant="outline"
          className="w-[640px] mt-4 h-12"
          onClick={() => router.push("/")}
        >
          Return to Home
        </Button>
      </div>
    </>
  );
}
