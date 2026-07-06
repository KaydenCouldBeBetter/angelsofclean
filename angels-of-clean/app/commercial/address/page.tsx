"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBookingStore } from "@/store/bookingStore";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SERVICE_AREA_ZIPS } from "@/lib/constants";

const SQFT_RANGES = [
  { id: "small" as const, label: "Under 1,000 sqft" },
  { id: "medium" as const, label: "1,000-5,000 sqft" },
  { id: "large" as const, label: "5,000-15,000 sqft" },
  { id: "enterprise" as const, label: "15,000+ sqft" },
];
export default function AddressPage() {
  const router = useRouter();
  const store = useBookingStore();
  const { setStep2, setCommercialStep2 } = store;

  useEffect(() => {
    if (!store.facilityType) router.replace("/commercial");
  }, [store.facilityType, router]);

  const [address, setAddress] = useState(store.address || "");
  const [city, setCity] = useState(store.city || "");
  const [zip, setZip] = useState(store.zip || "");
  const [selectedSqft, setSelectedSqft] = useState(store.sqftRange ?? "small");
  const [restrooms, setRestrooms] = useState(store.restrooms ?? 1);
  const [touched, setTouched] = useState({ zip: false});

  const zipValid = /^\d{5}$/.test(zip.trim());
  const isValid = address.trim() !== "" && city.trim() !== "" && zipValid && selectedSqft !== null;

  function handleNext() {
    if (!SERVICE_AREA_ZIPS.includes(zip.trim())) { // if zip is not in the service area
      setStep2(address, city, zip);
      router.push("/commercial/error");
      return;
    }
    setStep2(address, city, zip);
    setCommercialStep2(selectedSqft, restrooms);
    router.push("/commercial/details");
  }

  return (
      <>
        <StepHeader step={2} totalSteps={5} backHref="/commercial" />
        <ProgressDots currentStep={2} totalSteps={5} />

        <div className="flex flex-col gap-6 px-4 pt-4 pb-32">
          <div>
            <h1 className="text-2xl font-bold leading-tight">
              Where is your facility?
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              We serve the greater Syracuse, NY area.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                  id="address"
                  placeholder="Enter street address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-14"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                  id="city"
                  placeholder="Enter city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-14"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                  id="zip"
                  placeholder="Enter ZIP code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, zip: true }))}
                  inputMode="numeric"
                  maxLength={5}
                  className="h-14"
              />
              {touched.zip && zip.trim() !== "" && !zipValid && (
                  <p className="text-xs text-red-500">Please enter a valid 5-digit ZIP code.</p>
              )}
            </div>

            <p className="text-xs text-zinc-400">
              Not in our area? Call (315) 555-CLEAN for a custom quote.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-zinc-900">Facility size</h2>
            <div role="radiogroup" aria-label="Facility size" className="flex flex-col gap-2">
              {SQFT_RANGES.map((range) => {
                const isSelected = selectedSqft === range.id;
                return (
                    <button
                        key={range.id}
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedSqft(range.id)}
                        className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${
                            isSelected
                                ? "border-teal-600 bg-teal-50 text-teal-700"
                                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                        }`}
                    >
                      {range.label}
                    </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-zinc-900">Number of restrooms</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setRestrooms((r) => Math.max(1, r - 1))}
                aria-label="Decrease restrooms"
                className="w-10 h-10 rounded-full border-2 border-zinc-200 text-zinc-700 text-lg font-semibold hover:border-zinc-300 transition-colors"
              >
                −
              </button>
              <span className="text-xl font-semibold text-zinc-900 w-6 text-center">
                {restrooms}
              </span>
              <button
                onClick={() => setRestrooms((r) => Math.min(20, r + 1))}
                aria-label="Increase restrooms"
                className="w-10 h-10 rounded-full border-2 border-zinc-200 text-zinc-700 text-lg font-semibold hover:border-zinc-300 transition-colors"
              >
                +
              </button>
            </div>
          </div>

        </div>

        <BottomCTA label="Next" onClick={handleNext} disabled={!isValid} />
      </>
  );
}
