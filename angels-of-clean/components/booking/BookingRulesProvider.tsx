"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_BOOKING_RULES, coerceBookingRules, type BookingRules } from "@/lib/booking-rules";

// The online booking rules (paused? which days are closed? how far ahead? how
// much notice?), fetched from the public rules route and shared with every step
// of the residential wizard. They only shape what the pages offer: submitBooking
// checks them again, with fresh data, so a page that is out of date or never got
// the rules can at worst show a day the server then refuses.

export type RulesStatus = "loading" | "ready" | "failed";
interface RulesValue {
  status: RulesStatus;
  rules: BookingRules;
}

// Until the rules arrive (or if they never do) the wizard behaves as it did
// before these settings existed.
const RulesContext = createContext<RulesValue>({ status: "loading", rules: DEFAULT_BOOKING_RULES });

export const RULES_URL = "/api/public/booking-rules";

export function BookingRulesProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [value, setValue] = useState<RulesValue>({ status: "loading", rules: DEFAULT_BOOKING_RULES });

  // Asked again on every step (the route is cached for 30 seconds), so a pause
  // set while someone is partway through is noticed at their next step.
  useEffect(() => {
    let cancelled = false;
    fetch(RULES_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("rules unavailable"))))
      .then((raw: unknown) => {
        const rules = coerceBookingRules(raw);
        if (cancelled) return;
        setValue((prev) => (rules ? { status: "ready", rules } : { status: "failed", rules: prev.rules }));
      })
      .catch(() => {
        if (!cancelled) setValue((prev) => ({ status: "failed", rules: prev.rules }));
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>;
}

export function useBookingRules(): RulesValue {
  return useContext(RulesContext);
}
