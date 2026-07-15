"use client";

import { useState, useEffect } from "react";
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
  COMMERCIAL_FREQUENCIES,
  SCHEDULE_PREFERENCES,
} from "@/lib/constants";
import type { CommercialFrequency, SchedulePreference } from "@/store/bookingStore";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

export default function CommercialStep3() {
  const router = useRouter();
  const store = useBookingStore();

  useEffect(() => {
    if (!store.facilityType) router.replace("/commercial");
  }, [store.facilityType, router]);

  const [name, setName] = useState(store.name || "");
  const [businessName, setBusinessName] = useState(store.businessName || "");
  const [email, setEmail] = useState(store.email || "");
  const [phone, setPhone] = useState(store.phone || "");
  const [frequency, setFrequency] = useState<CommercialFrequency>(
    store.commercialFrequency ?? null
  );
  const [schedulePreference, setSchedulePreference] = useState<SchedulePreference>(
    store.schedulePreference ?? null
  );
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
  });

  const emailValid = EMAIL_REGEX.test(email.trim());
  const phoneValid = PHONE_REGEX.test(phone.trim());
  const isValid =
    name.trim() !== "" &&
    businessName.trim() !== "" &&
    emailValid &&
    phoneValid &&
    frequency !== null;

  function handleNext() {
    if (!isValid) return;
    store.setCommercialContact(name, businessName, email, phone, frequency, schedulePreference);
    router.push("/commercial/review");
  }

  return (
    <>
      {/* Desktop */}
      <CommercialNav />
      <CommercialStepper currentStep={3} />

      {/* Mobile header */}
      <div className="md:hidden">
        <StepHeader step={3} totalSteps={4} backHref="/commercial/services" />
        <ProgressDots currentStep={3} totalSteps={4} />
      </div>

      {/* Content */}
      <div className="max-w-sm mx-auto md:max-w-3xl px-4 pt-6 pb-32 md:pb-12 md:pt-10 md:px-8">
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 leading-tight">
          Contact &amp; frequency
        </h1>
        <p className="text-sm text-zinc-500 mt-1 mb-6 md:mb-8">
          Tell us how to reach you and how often you need service.
        </p>

        {/* Name row (stacked on mobile, 2-col on desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-4 md:mb-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Contact Name</Label>
            <Input
              id="name"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              autoComplete="name"
              className="h-14"
            />
            {touched.name && name.trim() === "" && (
              <p className="text-xs text-red-500" role="alert">Name is required.</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessName">Business Name</Label>
            <Input
              id="businessName"
              placeholder="Company or facility name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              autoComplete="organization"
              className="h-14"
            />
          </div>
        </div>

        {/* Email / Phone row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-6 md:mb-8">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              autoComplete="email"
              className="h-14"
            />
            {touched.email && !emailValid && (
              <p className="text-xs text-red-500" role="alert">
                {email.trim() === "" ? "Email is required." : "Enter a valid email address."}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
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
            {touched.phone && !phoneValid && (
              <p className="text-xs text-red-500" role="alert">
                {phone.trim() === "" ? "Phone is required." : "Enter a valid 10-digit phone number."}
              </p>
            )}
          </div>
        </div>

        {/* Frequency */}
        <div className="mb-6 md:mb-8">
          <Label className="text-sm font-semibold text-zinc-900 mb-1 block">
            Preferred Cleaning Frequency
          </Label>
          <p className="text-xs text-zinc-500 mb-3">
            Select how often you&apos;d like cleaning service.
          </p>
          <div
            role="radiogroup"
            aria-label="Cleaning frequency"
            className="flex flex-wrap gap-2"
          >
            {COMMERCIAL_FREQUENCIES.map((freq) => {
              const isSelected = frequency === freq.id;
              return (
                <button
                  key={freq.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setFrequency(freq.id)}
                  className={`h-11 px-4 rounded-xl border-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-teal-600 bg-teal-700 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  {freq.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Schedule Preference */}
        <div className="mb-6 md:mb-8">
          <Label className="text-sm font-semibold text-zinc-900 mb-1 block">
            Schedule Preference{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </Label>
          <p className="text-xs text-zinc-500 mb-3">
            When would cleaning be least disruptive to your operations?
          </p>
          <div
            role="radiogroup"
            aria-label="Schedule preference"
            className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3"
          >
            {SCHEDULE_PREFERENCES.map((pref) => {
              const isSelected = schedulePreference === pref.id;
              return (
                <label
                  key={pref.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-teal-600 bg-teal-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="schedulePreference"
                    value={pref.id}
                    checked={isSelected}
                    onChange={() =>
                      setSchedulePreference(isSelected ? null : pref.id)
                    }
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      isSelected
                        ? "border-teal-600 bg-teal-600"
                        : "border-zinc-300"
                    }`}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? "text-teal-700" : "text-zinc-700"
                    }`}
                  >
                    {pref.label}
                  </span>
                </label>
              );
            })}
          </div>
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
            href="/commercial/services"
            className="text-sm text-teal-700 hover:text-teal-800 transition-colors"
          >
            ← Back to Service Scope
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
