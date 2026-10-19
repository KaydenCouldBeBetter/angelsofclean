"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StepHeader from "@/components/booking/StepHeader";
import ProgressDots from "@/components/booking/ProgressDots";
import BottomCTA from "@/components/booking/BottomCTA";
import { PrivacyNote } from "@/components/booking/PolicyNotes";
import HoneypotField from "@/components/booking/HoneypotField";
import DesktopNavbar, { COMMERCIAL_NAV_TAGLINE } from "@/components/booking/DesktopNavbar";
import DesktopStepper from "@/components/booking/DesktopStepper";
import Selectable, { SelectableGroup } from "@/components/booking/Selectable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import WhenHydrated from "@/components/booking/WhenHydrated";
import { useBookingStore } from "@/store/bookingStore";
import {
  COMMERCIAL_FREQUENCIES,
  COMMERCIAL_STEP_LABELS,
  FIELD_MAX_LENGTHS,
  SCHEDULE_PREFERENCES,
} from "@/lib/constants";
import type { CommercialFrequency, SchedulePreference } from "@/store/bookingStore";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

function CommercialStep3Content() {
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
  const [website, setWebsite] = useState("");
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
    store.setHoneypot(website);
    router.push("/commercial/review");
  }

  return (
    <>
      {/* Desktop */}
      <DesktopNavbar tagline={COMMERCIAL_NAV_TAGLINE} />
      <DesktopStepper steps={COMMERCIAL_STEP_LABELS} currentStep={3} />

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
              maxLength={FIELD_MAX_LENGTHS.name}
              className="h-14"
            />
            {touched.name && name.trim() === "" && (
              <p className="text-xs text-[#c0392b]" role="alert">Name is required.</p>
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
              maxLength={FIELD_MAX_LENGTHS.businessName}
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
              maxLength={FIELD_MAX_LENGTHS.email}
              className="h-14"
            />
            {touched.email && !emailValid && (
              <p className="text-xs text-[#c0392b]" role="alert">
                {email.trim() === "" ? "Email is required." : "Enter a valid email address."}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(315) 555-0123"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              autoComplete="tel"
              maxLength={FIELD_MAX_LENGTHS.phone}
              inputMode="tel"
              className="h-14"
            />
            {touched.phone && !phoneValid && (
              <p className="text-xs text-[#c0392b]" role="alert">
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
          <SelectableGroup
            type="radio"
            aria-label="Cleaning frequency"
            className="flex flex-wrap gap-2"
          >
            {COMMERCIAL_FREQUENCIES.map((freq) => (
              <Selectable
                key={freq.id}
                value={freq.id}
                selected={frequency === freq.id}
                onSelect={() => setFrequency(freq.id)}
                className="flex items-center justify-center h-11 px-6"
              >
                {freq.label}
              </Selectable>
            ))}
          </SelectableGroup>
        </div>

        {/* Schedule Preference */}
        <div className="mb-6 md:mb-8">
          <Label className="text-sm font-semibold text-zinc-900 mb-1 block">
            Schedule Preference{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </Label>
          <p className="text-xs text-zinc-500 mb-3">
            When would cleaning be least disruptive to your operations?
          </p>
          <SelectableGroup
            type="radio"
            aria-label="Schedule preference"
            className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3"
          >
            {SCHEDULE_PREFERENCES.map((pref) => (
              <Selectable
                key={pref.id}
                value={pref.id}
                selected={schedulePreference === pref.id}
                onSelect={() => setSchedulePreference(pref.id)}
                className="flex items-center p-3 pr-8"
              >
                {pref.label}
              </Selectable>
            ))}
          </SelectableGroup>
        </div>

        <HoneypotField value={website} onChange={setWebsite} />

        <div className="mb-6 md:mb-8">
          <PrivacyNote />
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
            className="text-sm text-primary hover:text-primary-pressed transition-colors"
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

export default function CommercialStep3() {
  return (
    <WhenHydrated>
      <CommercialStep3Content />
    </WhenHydrated>
  );
}
