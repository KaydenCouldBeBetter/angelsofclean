"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { useBookingStore } from "@/store/bookingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

export default function ContactPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const store = useBookingStore();
  const { setStep5 } = store;

  useEffect(() => {
    if (!store.date) router.replace("/residential");
  }, [store.date, router]);

  const [name, setName] = useState(store.name || "");
  const [email, setEmail] = useState(store.email || "");
  const [phone, setPhone] = useState(store.phone || "");
  const [touched, setTouched] = useState({ name: false, email: false, phone: false });

  const emailValid = EMAIL_REGEX.test(email.trim());
  const phoneValid = PHONE_REGEX.test(phone.trim());
  const isValid = name.trim() !== "" && emailValid && phoneValid;

  function handleNext() {
    setStep5(name, email, phone);
    router.push("/residential/review");
  }

  return (
    <>
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
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              autoComplete="name"
              className="h-14"
            />
            {touched.name && name.trim() === "" && (
              <p className="text-xs text-red-500">Full name is required.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              autoComplete="email"
              className="h-14"
            />
            {touched.email && email.trim() !== "" && !emailValid && (
              <p className="text-xs text-red-500">Please enter a valid email address.</p>
            )}
            {touched.email && email.trim() === "" && (
              <p className="text-xs text-red-500">Email is required.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(315) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              autoComplete="tel"
              inputMode="tel"
              className="h-14"
            />
            {touched.phone && phone.trim() !== "" && !phoneValid && (
              <p className="text-xs text-red-500">Please enter a valid 10-digit phone number.</p>
            )}
            {touched.phone && phone.trim() === "" && (
              <p className="text-xs text-red-500">Phone number is required.</p>
            )}
          </div>

          <p className="text-xs text-zinc-400">
            Your information is only used to confirm your booking.
          </p>
        </div>
      </div>

      <BottomCTA label={returnTo === "review" ? "Save & Return to Review" : "Next"} onClick={handleNext} disabled={!isValid} />
    </>
  );
}
