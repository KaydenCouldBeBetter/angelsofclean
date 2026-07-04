"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SERVICE_AREA_ZIPS } from "@/lib/constants";

export default function AddressPage() {
  const router = useRouter();
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
    router.push("/residential/property");
  }

  return (
    <>
      <StepHeader step={2} totalSteps={6} backHref="/residential" />
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
      </div>

      <BottomCTA label="Next" onClick={handleNext} disabled={!isValid} />
    </>
  );
}
