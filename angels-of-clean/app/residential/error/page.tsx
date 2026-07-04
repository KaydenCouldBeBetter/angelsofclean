"use client";

import { useRouter } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";

export default function ServiceAreaErrorPage() {
  const router = useRouter();
  const { address, city, zip } = useBookingStore();

  return (
    <>
      <StepHeader step={2} totalSteps={6} backHref="/residential/address" />
      <ProgressDots currentStep={2} totalSteps={6} />

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32">
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            Where should we clean?
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            We serve the greater Syracuse, NY area.
          </p>
        </div>

        {/* Pre-filled address */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Street Address</span>
          <div className="h-14 flex items-center px-3 rounded-lg border-2 border-red-400 bg-white">
            <span className="text-zinc-900">{address}</span>
          </div>
        </div>

        {/* Error banner */}
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <span className="text-red-500 mt-0.5" role="img" aria-label="Warning">⚠</span>
          <p className="text-sm text-red-700">
            We don&apos;t currently serve this area. Check our service zone or call{" "}
            <span className="font-semibold">(315) 555-CLEAN</span> for a custom quote.
          </p>
        </div>

        {/* City and ZIP read-only */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">City</span>
          <div className="h-14 flex items-center px-3 rounded-lg border border-zinc-200 bg-zinc-50">
            <span className="text-zinc-500">{city}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">ZIP Code</span>
          <div className="h-14 flex items-center px-3 rounded-lg border border-zinc-200 bg-zinc-50">
            <span className="text-zinc-500">{zip}</span>
          </div>
        </div>
      </div>

      <BottomCTA
        label="Try a Different Address"
        onClick={() => router.push("/residential/address")}
      />
    </>
  );
}
