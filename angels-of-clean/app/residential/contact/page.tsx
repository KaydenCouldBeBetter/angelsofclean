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
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <StepHeader step={5} totalSteps={6} backHref="/residential/datetime" />
        <ProgressDots currentStep={5} totalSteps={6} />
      </div>

      <div className="flex flex-col gap-6 px-4 pt-4 pb-32 lg:px-0 lg:pb-0">
        <div>
          <h1 className="text-2xl font-bold leading-tight lg:text-3xl">
            How can we reach you?
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            We&apos;ll only use this to confirm your booking. No account required.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {/* Full Name — full width */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              autoComplete="name"
              className="h-12"
            />
            {touched.name && name.trim() === "" && (
              <p className="text-xs text-red-500">Full name is required.</p>
            )}
          </div>

          {/* Email + Phone — stacked on mobile, side by side on desktop */}
          <div className="flex flex-col gap-5 lg:flex-row lg:gap-4">
            <div className="flex flex-col gap-2 lg:flex-1">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                autoComplete="email"
                className="h-12"
              />
              {touched.email && email.trim() !== "" && !emailValid && (
                <p className="text-xs text-red-500">Please enter a valid email address.</p>
              )}
              {touched.email && email.trim() === "" && (
                <p className="text-xs text-red-500">Email is required.</p>
              )}
            </div>

            <div className="flex flex-col gap-2 lg:flex-1">
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
                className="h-12"
              />
              {touched.phone && phone.trim() !== "" && !phoneValid && (
                <p className="text-xs text-red-500">Please enter a valid 10-digit phone number.</p>
              )}
              {touched.phone && phone.trim() === "" && (
                <p className="text-xs text-red-500">Phone number is required.</p>
              )}
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            Your information is secure. We never share your data with third parties.
          </p>
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
            <Link href="/residential/datetime" className="text-sm font-medium text-[#1a6b5a] hover:underline">
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
