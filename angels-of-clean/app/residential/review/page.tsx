"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { SERVICE_LABELS, FREQUENCY_LABELS, TIME_LABELS, PRICE_MAP } from "@/lib/constants";

export default function ReviewPage() {
  const router = useRouter();
  const store = useBookingStore();

  const {
    service, frequency,
    address, city, zip,
    bedrooms, bathrooms,
    date, timeSlot,
    name, email, phone,
    isSubmitting, setSubmitting,
  } = store;

  useEffect(() => {
    if (!service || !address || !date || !name) router.replace("/residential");
  }, [service, address, date, name, router]);

  const formattedDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "long", day: "numeric",
      })
    : "";

  function handleConfirm() {
    if (isSubmitting) return;
    setSubmitting(true);
    router.push("/residential/confirmation");
  }

  return (
    <>
      <StepHeader step={6} totalSteps={6} backHref="/residential/contact" />
      <ProgressDots currentStep={6} totalSteps={6} />

      <div className="flex flex-col gap-3 px-4 pt-4 pb-32">
        <h1 className="text-2xl font-bold leading-tight mb-2">
          Review your booking
        </h1>

        {/* Service */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Service</span>
            <Link href="/residential?returnTo=review" className="text-sm text-teal-600 font-medium">Edit</Link>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">
            {service ? SERVICE_LABELS[service] : "—"} · {frequency ? FREQUENCY_LABELS[frequency] : "—"}
          </p>
        </div>

        {/* Property */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Property</span>
            <Link href="/residential/property?returnTo=review" className="text-sm text-teal-600 font-medium">Edit</Link>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">
            {bedrooms} Bed, {bathrooms} Bath
          </p>
          <p className="text-sm text-zinc-500">{address}, {city}, NY {zip}</p>
        </div>

        {/* Date & Time */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Date &amp; Time</span>
            <Link href="/residential/datetime?returnTo=review" className="text-sm text-teal-600 font-medium">Edit</Link>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">
            {formattedDate} · {timeSlot ? TIME_LABELS[timeSlot] : "—"}
          </p>
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Contact</span>
            <Link href="/residential/contact?returnTo=review" className="text-sm text-teal-600 font-medium">Edit</Link>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">{name}</p>
          <p className="text-sm text-zinc-500">{email}</p>
          <p className="text-sm text-zinc-500">{phone}</p>
        </div>

        {/* Price */}
        <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
          <p className="font-semibold text-zinc-900">
            Estimated starting price: from {service ? PRICE_MAP[service] : "—"}
          </p>
        </div>
      </div>

      <BottomCTA label={isSubmitting ? "Submitting…" : "Confirm Booking"} onClick={handleConfirm} disabled={isSubmitting} />
    </>
  );
}
