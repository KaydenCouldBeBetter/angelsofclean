"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SERVICE_AREA_ZIPS } from "@/lib/constants";

export default function AddressPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const store = useBookingStore();
  const { setStep2 } = store;

  useEffect(() => {
    if (!store.service) router.replace("/residential");
  }, [store.service, router]);

  const [address, setAddress] = useState(store.address || "");
  const [city, setCity] = useState(store.city || "");
  const [zip, setZip] = useState(store.zip || "");

  const [touched, setTouched] = useState({ zip: false });
  const zipValid = /^\d{5}$/.test(zip.trim());
  const isValid = address.trim() !== "" && city.trim() !== "" && zipValid;

  function handleNext() {
    if (!SERVICE_AREA_ZIPS.includes(zip.trim())) {
      setStep2(address, city, zip);
      router.push("/residential/error");
      return;
    }
    setStep2(address, city, zip);
    router.push(returnTo === "review" ? "/residential/review" : "/residential/property");
  }

  return (
    <>
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <StepHeader step={2} totalSteps={6} backHref="/residential" />
        <ProgressDots currentStep={2} totalSteps={6} />
      </div>

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32 lg:px-0 lg:pb-0">
        <div>
          <h1 className="text-2xl font-bold leading-tight lg:text-3xl">
            Where should we clean?
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            We&apos;ll verify your address is within our service area.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {/* Street Address — full width */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              placeholder="123 Main Street"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-12"
            />
          </div>

          {/* City + ZIP — stacked on mobile, side by side on desktop */}
          <div className="flex flex-col gap-5 lg:flex-row lg:gap-4">
            <div className="flex flex-col gap-2 lg:flex-[2]">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Syracuse"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-12"
              />
            </div>

            <div className="flex flex-col gap-2 lg:flex-1">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                placeholder="13039"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, zip: true }))}
                inputMode="numeric"
                maxLength={5}
                className="h-12"
              />
              {touched.zip && zip.trim() !== "" && !zipValid && (
                <p className="text-xs text-red-500">Please enter a valid 5-digit ZIP code.</p>
              )}
            </div>
          </div>

          {/* Service area note */}
          <div className="rounded-xl bg-teal-50 px-4 py-3">
            <p className="text-sm text-[#1a6b5a]">
              We currently serve: Cicero, Camillus, Syracuse, Liverpool, Baldwinsville, Brewerton, Solvay, Manlius, and Marcellus.
            </p>
          </div>
        </div>

        {/* Desktop inline CTA */}
        <div className="hidden lg:block mt-2">
          <button
            onClick={handleNext}
            disabled={!isValid}
            className="w-[360px] h-14 rounded-xl bg-[#1a6b5a] text-white text-base font-semibold hover:bg-[#155a4b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {returnTo === "review" ? "Save & Return to Review" : "Next \u2192"}
          </button>
          <div className="mt-3">
            <Link href="/residential" className="text-sm font-medium text-[#1a6b5a] hover:underline">
              &larr; Back
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile fixed CTA */}
      <div className="lg:hidden">
        <BottomCTA label={returnTo === "review" ? "Save & Return to Review" : "Next"} onClick={handleNext} disabled={!isValid} />
      </div>
    </>
  );
}
