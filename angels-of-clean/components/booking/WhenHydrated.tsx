"use client";

import { useBookingHydrated } from "@/store/bookingStore";

/**
 * Mounts its children only once the booking store has been filled from
 * sessionStorage. A step form that seeds its fields from the store must sit
 * inside this: during hydration the store reads as empty, and `useState`
 * would keep those empty values after the saved ones arrive.
 */
export default function WhenHydrated({ children }: { children: React.ReactNode }) {
  return useBookingHydrated() ? <>{children}</> : null;
}
