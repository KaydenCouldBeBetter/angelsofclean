"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ContactPage() {
  const router = useRouter();
  const { setStep5 } = useBookingStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const isValid = name.trim() !== "" && email.trim() !== "" && phone.trim() !== "";

  function handleNext() {
    setStep5(name, email, phone);
    router.push("/residential/review");
  }

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-sm mx-auto">
      <StepHeader step={5} totalSteps={6} backHref="/residential/datetime" />
      <ProgressDots currentStep={5} totalSteps={6} />

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32">
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            Your contact information
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            No account required — you&apos;ll get a confirmation email.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="h-14"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-14"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(315) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              className="h-14"
            />
          </div>

          <p className="text-xs text-zinc-400">
            Your information is only used to confirm your booking.
          </p>
        </div>
      </div>

      <BottomCTA label="Next" onClick={handleNext} disabled={!isValid} />
    </div>
  );
}
