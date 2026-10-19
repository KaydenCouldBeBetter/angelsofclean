import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { TIME_SLOT_WINDOWS } from "@/lib/constants";
import { isNyWallClockInFuture, isValidDateStr, nyDateStr } from "@/lib/datetime";

// Residential types
export type ServiceType = "standard" | "deep" | "moveinout" | null;
export type Frequency = "one-time" | "weekly" | "bi-weekly" | "monthly" | null;
export type TimeSlot = "morning" | "afternoon" | null;

// Commercial types
export type CommercialFacilityType =
  | "office"
  | "retail"
  | "medical"
  | "warehouse"
  | "school"
  | "restaurant"
  | null;

export type CommercialSqftRange = "<1k" | "1k-2k" | "2k-5k" | "5k+" | null;

export type CommercialFrequency =
  | "daily"
  | "2-3x"
  | "weekly"
  | "bi-weekly"
  | "monthly"
  | "one-time"
  | null;

export type SchedulePreference = "before" | "during" | "after" | "weekends" | null;

interface BookingState {
  // ── Residential Step 1 ──────────────────────────────────────────────
  service: ServiceType;
  frequency: Frequency;

  // ── Shared address (Res Step 2 / Com Step 1) ────────────────────────
  address: string;
  city: string;
  zip: string;

  // ── Residential Step 3 ──────────────────────────────────────────────
  bedrooms: number;
  bathrooms: number;
  notes: string;

  // ── Residential Step 4 ──────────────────────────────────────────────
  date: string;
  timeSlot: TimeSlot;

  // ── Shared contact (Res Step 5 / Com Step 3) ────────────────────────
  name: string;
  email: string;
  phone: string;

  // ── Submission flag ─────────────────────────────────────────────────
  isSubmitting: boolean;

  // True when the saved date had passed on load and was cleared. Never
  // persisted: it only lives long enough to explain the cleared date.
  dateExpired: boolean;

  // ── Commercial Step 1 ───────────────────────────────────────────────
  facilityType: CommercialFacilityType;
  sqftRange: CommercialSqftRange;

  // ── Commercial Step 2 ───────────────────────────────────────────────
  floors: number;
  serviceAreas: string[];
  commercialNotes: string;

  // ── Commercial Step 3 ───────────────────────────────────────────────
  businessName: string;
  commercialFrequency: CommercialFrequency;
  schedulePreference: SchedulePreference;

  // ── Residential actions ─────────────────────────────────────────────
  setStep1: (service: ServiceType, frequency: Frequency) => void;
  setStep2: (address: string, city: string, zip: string) => void;
  setStep3: (bedrooms: number, bathrooms: number, notes: string) => void;
  setStep4: (date: string, timeSlot: TimeSlot) => void;
  setStep5: (name: string, email: string, phone: string) => void;

  // ── Commercial actions ──────────────────────────────────────────────
  setCommercialStep1: (
    facilityType: CommercialFacilityType,
    sqftRange: CommercialSqftRange,
    address: string,
    city: string,
    zip: string
  ) => void;
  setCommercialStep2: (floors: number, serviceAreas: string[], notes: string) => void;
  setCommercialContact: (
    name: string,
    businessName: string,
    email: string,
    phone: string,
    frequency: CommercialFrequency,
    schedulePreference: SchedulePreference
  ) => void;

  setSubmitting: (value: boolean) => void;
  clearDateExpired: () => void;
  reset: () => void;
}

/**
 * True if a saved date can no longer be booked: malformed, on a past New York
 * day, or (with a slot chosen) a slot whose start has already passed. Without a
 * slot only the day matters, since a later slot may still be open today.
 */
export function isSavedDateExpired(date: string, timeSlot: TimeSlot, now: Date = new Date()) {
  if (!date) return false;
  if (!isValidDateStr(date)) return true;
  if (timeSlot) {
    return !isNyWallClockInFuture(date, TIME_SLOT_WINDOWS[timeSlot].start, now);
  }
  return date < nyDateStr(now);
}

const defaultState = {
  // Residential
  service: null as ServiceType,
  frequency: null as Frequency,
  address: "",
  city: "",
  zip: "",
  bedrooms: 2,
  bathrooms: 1,
  notes: "",
  date: "",
  timeSlot: null as TimeSlot,
  name: "",
  email: "",
  phone: "",
  isSubmitting: false,
  dateExpired: false,

  // Commercial
  facilityType: null as CommercialFacilityType,
  sqftRange: null as CommercialSqftRange,
  floors: 1,
  serviceAreas: [] as string[],
  commercialNotes: "",
  businessName: "",
  commercialFrequency: null as CommercialFrequency,
  schedulePreference: null as SchedulePreference,
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
      ...defaultState,

      // Residential
      setStep1: (service, frequency) => set({ service, frequency }),
      setStep2: (address, city, zip) => set({ address, city, zip }),
      setStep3: (bedrooms, bathrooms, notes) => set({ bedrooms, bathrooms, notes }),
      setStep4: (date, timeSlot) => set({ date, timeSlot, dateExpired: false }),
      setStep5: (name, email, phone) => set({ name, email, phone }),

      // Commercial
      setCommercialStep1: (facilityType, sqftRange, address, city, zip) =>
        set({ facilityType, sqftRange, address, city, zip }),
      setCommercialStep2: (floors, serviceAreas, notes) =>
        set({ floors, serviceAreas, commercialNotes: notes }),
      setCommercialContact: (name, businessName, email, phone, frequency, schedulePreference) =>
        set({ name, businessName, email, phone, commercialFrequency: frequency, schedulePreference }),

      setSubmitting: (value) => set({ isSubmitting: value }),
      clearDateExpired: () => set({ dateExpired: false }),
      reset: () => set(defaultState),
    }),
    {
      name: "booking-store",
      storage: createJSONStorage(() => sessionStorage),
      // A saved date can go stale between visits (sessionStorage outlives a
      // tab's idle hours): don't revive one that has passed. The slot is kept,
      // since it is a preference rather than a date.
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<BookingState> | undefined) };
        if (isSavedDateExpired(merged.date, merged.timeSlot)) {
          return { ...merged, date: "", dateExpired: true };
        }
        return merged;
      },
      partialize: (state) => ({
        // Residential
        service: state.service,
        frequency: state.frequency,
        address: state.address,
        city: state.city,
        zip: state.zip,
        bedrooms: state.bedrooms,
        bathrooms: state.bathrooms,
        notes: state.notes,
        date: state.date,
        timeSlot: state.timeSlot,
        name: state.name,
        email: state.email,
        phone: state.phone,
        // Commercial
        facilityType: state.facilityType,
        sqftRange: state.sqftRange,
        floors: state.floors,
        serviceAreas: state.serviceAreas,
        commercialNotes: state.commercialNotes,
        businessName: state.businessName,
        commercialFrequency: state.commercialFrequency,
        schedulePreference: state.schedulePreference,
      }),
    }
  )
);

/**
 * True once the store has been filled from sessionStorage. Step guards must not
 * redirect before this: while React hydrates, Zustand serves the default
 * (empty) state, so a guard would send a visitor with a saved booking back to
 * step 1. The server snapshot is false, so this is also false during hydration.
 */
export function useBookingHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useBookingStore.persist.onFinishHydration(onChange),
    () => useBookingStore.persist.hasHydrated(),
    () => false
  );
}
