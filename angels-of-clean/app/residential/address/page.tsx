"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SERVICE_AREA_ZIPS = [
  "13039", // Cicero
  "13035", // Camillus
  "13201", "13202", "13203", "13204", "13205", "13206", "13207", "13208", "13210", "13214", "13215", "13219", "13224", // Syracuse
  "13088", "13090", // Liverpool
  "13027", // Baldwinsville
  "13029", // Brewerton
  "13209", // Solvay
  "13104", // Manlius
  "13108", // Marcellus
];

export default function AddressPage() {
  const router = useRouter();
  const { setStep2 } = useBookingStore();

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");

  const isValid = address.trim() !== "" && city.trim() !== "" && zip.trim() !== "";

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
    <div className="flex flex-col min-h-screen bg-white max-w-sm mx-auto">
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
              inputMode="numeric"
              maxLength={5}
              className="h-14"
            />
          </div>

          <p className="text-xs text-zinc-400">
            Not in our area? Call (315) 555-CLEAN for a custom quote.
          </p>
        </div>
      </div>

      <BottomCTA label="Next" onClick={handleNext} disabled={!isValid} />
    </div>
  );
}
