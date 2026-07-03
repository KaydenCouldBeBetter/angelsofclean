"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";

const SERVICE_LABELS: Record<string, string> = {
  standard: "Standard Clean",
  deep: "Deep Clean",
  moveinout: "Move-In / Move-Out",
};

const FREQUENCY_LABELS: Record<string, string> = {
  "one-time": "One-time",
  weekly: "Weekly",
  "bi-weekly": "Bi-weekly",
  monthly: "Monthly",
};

const TIME_LABELS: Record<string, string> = {
  morning: "Morning (8am–12pm)",
  afternoon: "Afternoon (12pm–4pm)",
};

const PRICE_MAP: Record<string, string> = {
  standard: "$85",
  deep: "$149",
  moveinout: "$199",
};

export default function ReviewPage() {
  const router = useRouter();
  const store = useBookingStore();

  const {
    service, frequency,
    address, city, zip,
    bedrooms, bathrooms,
    date, timeSlot,
    name, email, phone,
  } = store;

  const formattedDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "long", day: "numeric",
      })
    : "";

  function handleConfirm() {
    router.push("/residential/confirmation");
  }

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-sm mx-auto">
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
            <Link href="/residential" className="text-sm text-teal-600 font-medium">Edit</Link>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">
            {SERVICE_LABELS[service ?? "standard"]} · {FREQUENCY_LABELS[frequency ?? "one-time"]}
          </p>
        </div>

        {/* Property */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Property</span>
            <Link href="/residential/property" className="text-sm text-teal-600 font-medium">Edit</Link>
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
            <Link href="/residential/datetime" className="text-sm text-teal-600 font-medium">Edit</Link>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">
            {formattedDate} · {TIME_LABELS[timeSlot ?? "morning"]}
          </p>
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 uppercase tracking-wide">Contact</span>
            <Link href="/residential/contact" className="text-sm text-teal-600 font-medium">Edit</Link>
          </div>
          <p className="mt-1 font-semibold text-zinc-900">{name}</p>
          <p className="text-sm text-zinc-500">{email}</p>
          <p className="text-sm text-zinc-500">{phone}</p>
        </div>

        {/* Price */}
        <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
          <p className="font-semibold text-zinc-900">
            Estimated starting price: from {PRICE_MAP[service ?? "standard"]}
          </p>
        </div>
      </div>

      <BottomCTA label="Confirm Booking" onClick={handleConfirm} />
    </div>
  );
}
