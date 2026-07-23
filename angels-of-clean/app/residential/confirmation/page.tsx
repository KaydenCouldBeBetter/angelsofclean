"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { Button } from "@/components/ui/button";
import { SERVICE_LABELS, FREQUENCY_LABELS, TIME_LABELS } from "@/lib/constants";

export default function ConfirmationPage() {
  const router = useRouter();
  const {
    service, frequency, date, timeSlot,
    address, city, zip,
    bedrooms, bathrooms,
    email, reset, setSubmitting,
  } = useBookingStore();

  useEffect(() => {
    if (!service || !email) router.replace("/residential");
    setSubmitting(false);
  }, [service, email, router, setSubmitting]);

  const formattedDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "";

  const serviceLabel = `${SERVICE_LABELS[service ?? "standard"]} \u00B7 ${FREQUENCY_LABELS[frequency ?? "one-time"]}`;
  const timeLabel = timeSlot ? TIME_LABELS[timeSlot] : "";

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
          <div className="w-20 h-20 rounded-full border-2 border-teal-500 flex items-center justify-center" role="img" aria-label="Booking confirmed">
            <span className="text-3xl text-teal-600" aria-hidden="true">&#10003;</span>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-zinc-900">You&apos;re booked!</h1>
            <p className="text-sm text-zinc-500 mt-1">
              We&apos;ll send a confirmation to {email}
            </p>
          </div>

          {/* Booking detail card */}
          <div className="w-full rounded-xl border border-zinc-200 p-4 flex flex-col gap-1">
            <p className="font-semibold text-zinc-900">{serviceLabel}</p>
            <p className="text-sm text-zinc-500">{formattedDate} \u00B7 {timeLabel}</p>
            <p className="text-sm text-zinc-500">{address}, {city}, NY {zip}</p>
          </div>

          {/* Calendar buttons */}
          <div className="w-full flex flex-col gap-3">
            <Button variant="outline" className="w-full h-14">
              Add to Google Calendar
            </Button>
            <Button variant="outline" className="w-full h-14">
              Add to Apple Calendar
            </Button>
          </div>

          <div className="w-full border-t border-zinc-100 pt-4">
            <div className="rounded-xl border border-zinc-200 p-4 flex flex-col gap-3">
              <p className="font-semibold text-zinc-900">Save your details for next time?</p>
              <p className="text-sm text-zinc-500">
                Create an account to pre-fill your info on future bookings.
              </p>
              <Button className="w-fit h-11">Create Account</Button>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-14"
            onClick={() => { reset(); router.push("/"); }}
          >
            Return to Home
          </Button>
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:flex flex-col items-center py-10">
        {/* Success icon */}
        <div className="w-[120px] h-[120px] rounded-full bg-teal-50 flex items-center justify-center mb-6" role="img" aria-label="Booking confirmed">
          <span className="text-5xl text-[#1a6b5a]" aria-hidden="true">&#10003;</span>
        </div>

        <h1 className="text-3xl font-bold text-zinc-900">Booking Confirmed!</h1>
        <p className="text-base text-zinc-500 mt-2">
          Your cleaning has been scheduled. We&apos;ve sent a confirmation to {email}.
        </p>

        {/* Detail card */}
        <div className="w-[640px] mt-8 rounded-xl border border-zinc-200 bg-white p-6 flex flex-col gap-2">
          <p className="font-semibold text-zinc-900">{serviceLabel}</p>
          <p className="text-sm text-zinc-500">{formattedDate} \u00B7 {timeLabel}</p>
          <p className="text-sm text-zinc-500">{address}, {city}, NY {zip}</p>
          <p className="text-sm text-zinc-500">{bedrooms} Bedrooms \u00B7 {bathrooms} Bathroom</p>
        </div>

        {/* Calendar buttons — side by side */}
        <div className="w-[640px] mt-4 flex gap-4">
          <Button variant="outline" className="flex-1 h-12">
            Add to Google Calendar
          </Button>
          <Button variant="outline" className="flex-1 h-12">
            Add to Apple Calendar
          </Button>
        </div>

        {/* Upsell card */}
        <div className="w-[640px] mt-4 rounded-xl bg-teal-50 border border-teal-100 p-5">
          <p className="font-semibold text-zinc-900">Save your details for faster booking next time</p>
          <p className="text-sm text-zinc-500 mt-1">
            Create a free account &mdash; no password required during booking.
          </p>
          <Button className="mt-3 h-9 px-5 bg-[#1a6b5a] hover:bg-[#155a4b] text-sm">
            Create Account
          </Button>
        </div>

        {/* Return home */}
        <Button
          variant="outline"
          className="w-[640px] mt-4 h-12"
          onClick={() => { reset(); router.push("/"); }}
        >
          Return to Home
        </Button>
      </div>
    </>
  );
}
