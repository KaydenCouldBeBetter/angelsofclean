"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import { Button } from "@/components/ui/button";
import { SERVICE_LABELS, TIME_LABELS } from "@/lib/constants";

export default function ConfirmationPage() {
  const router = useRouter();
  const { service, date, timeSlot, address, city, zip, email, reset, setSubmitting } = useBookingStore();

  useEffect(() => {
    if (!service || !email) router.replace("/residential");
    setSubmitting(false);
  }, [service, email, router, setSubmitting]);

  const formattedDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-center h-14 border-b border-zinc-100">
        <span className="font-semibold text-zinc-900">Angels of Clean</span>
      </div>

      <div className="flex flex-col items-center gap-6 px-4 pt-10 pb-10">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full border-2 border-teal-500 flex items-center justify-center" role="img" aria-label="Booking confirmed">
          <span className="text-3xl text-teal-600" aria-hidden="true">✓</span>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900">You&apos;re booked!</h1>
          <p className="text-sm text-zinc-500 mt-1">
            We&apos;ll send a confirmation to {email}
          </p>
        </div>

        {/* Booking detail card */}
        <div className="w-full rounded-xl border border-zinc-200 p-4 flex flex-col gap-1">
          <p className="font-semibold text-zinc-900">
            {SERVICE_LABELS[service ?? "standard"]} · {formattedDate}
          </p>
          <p className="text-sm text-zinc-500">{address}, {city}, NY {zip}</p>
          <p className="text-sm text-zinc-500">
            {TIME_LABELS[timeSlot ?? "morning"]}
          </p>
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
