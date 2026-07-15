"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import CommercialNav from "@/components/booking/CommercialNav";
import CommercialStepper from "@/components/booking/CommercialStepper";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useBookingStore } from "@/store/bookingStore";
import {
  COMMERCIAL_FACILITY_TYPES,
  COMMERCIAL_SQFT_RANGES,
  SERVICE_AREA_ZIPS,
} from "@/lib/constants";
import type { CommercialFacilityType, CommercialSqftRange } from "@/store/bookingStore";

export default function CommercialStep1() {
  const router = useRouter();
  const store = useBookingStore();

  const [facilityType, setFacilityType] = useState<CommercialFacilityType>(
    store.facilityType ?? null
  );
  const [sqftRange, setSqftRange] = useState<CommercialSqftRange>(
    store.sqftRange ?? null
  );
  const [address, setAddress] = useState(store.address || "");
  const [city, setCity] = useState(store.city || "");
  const [zip, setZip] = useState(store.zip || "");
  const [touched, setTouched] = useState({ zip: false });

  const zipValid = /^\d{5}$/.test(zip.trim());
  const isValid =
    facilityType !== null &&
    sqftRange !== null &&
    address.trim() !== "" &&
    city.trim() !== "" &&
    zipValid;

  function handleNext() {
    if (!isValid) return;
    store.setCommercialStep1(facilityType, sqftRange, address, city, zip);
    if (!SERVICE_AREA_ZIPS.includes(zip.trim())) {
      router.push("/commercial/error");
      return;
    }
    router.push("/commercial/services");
  }

  return (
    <>
      {/* Desktop */}
      <CommercialNav />
      <CommercialStepper currentStep={1} />

      {/* Mobile header */}
      <div className="md:hidden">
        <StepHeader step={1} totalSteps={4} backHref="/" />
        <ProgressDots currentStep={1} totalSteps={4} />
      </div>

      {/* Content */}
      <div className="max-w-sm mx-auto md:max-w-3xl px-4 pt-6 pb-32 md:pb-12 md:pt-10 md:px-8">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 leading-tight">
          Tell us about your facility
        </h1>
        <p className="text-sm text-zinc-500 mt-1 mb-6 md:mb-8">
          This helps us prepare an accurate quote for your business.
        </p>

        {/* Facility Type */}
        <div className="mb-6 md:mb-8">
          <Label className="text-sm font-semibold text-zinc-900 mb-3 block">
            Facility Type
          </Label>
          <div
            role="radiogroup"
            aria-label="Facility type"
            className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3"
          >
            {COMMERCIAL_FACILITY_TYPES.map((ft) => {
              const isSelected = facilityType === ft.id;
              return (
                <button
                  key={ft.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setFacilityType(ft.id)}
                  className={`h-12 md:h-12 rounded-xl border-2 text-sm font-medium transition-colors px-3 ${
                    isSelected
                      ? "border-teal-600 bg-teal-50 text-teal-700"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  {ft.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Square Footage */}
        <div className="mb-6 md:mb-8">
          <Label className="text-sm font-semibold text-zinc-900 mb-3 block">
            Approximate Square Footage
          </Label>
          <div
            role="radiogroup"
            aria-label="Square footage range"
            className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3"
          >
            {COMMERCIAL_SQFT_RANGES.map((range) => {
              const isSelected = sqftRange === range.id;
              return (
                <button
                  key={range.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSqftRange(range.id)}
                  className={`h-11 rounded-xl border-2 text-sm font-medium transition-colors px-2 md:px-3 ${
                    isSelected
                      ? "border-teal-600 bg-teal-700 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <span className="md:hidden">{range.shortLabel}</span>
                  <span className="hidden md:inline">{range.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Service Address */}
        <div className="flex flex-col gap-4 md:gap-5 mb-6 md:mb-8">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Service Address</Label>
            <Input
              id="address"
              placeholder="Enter street address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              className="h-14"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
                className="h-14"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                placeholder="13201"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, zip: true }))}
                inputMode="numeric"
                maxLength={5}
                autoComplete="postal-code"
                className="h-14"
              />
              {touched.zip && zip.trim() !== "" && !zipValid && (
                <p className="text-xs text-red-500" role="alert">
                  Enter a valid 5-digit ZIP code.
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            We serve the greater Syracuse, NY area. Call{" "}
            <span className="font-medium">(315) 555-0100</span> if you&apos;re
            unsure about your location.
          </p>
        </div>

        {/* Desktop Next + Back */}
        <div className="hidden md:flex md:flex-col md:gap-4">
          <Button
            onClick={handleNext}
            disabled={!isValid}
            className="w-64 h-14 text-base font-semibold"
          >
            Next →
          </Button>
          <Link
            href="/"
            className="text-sm text-teal-700 hover:text-teal-800 transition-colors"
          >
            ← Back to Commercial Services
          </Link>
        </div>
      </div>

      {/* Mobile bottom CTA */}
      <div className="md:hidden">
        <BottomCTA label="Next" onClick={handleNext} disabled={!isValid} />
      </div>
    </>
  );
}
