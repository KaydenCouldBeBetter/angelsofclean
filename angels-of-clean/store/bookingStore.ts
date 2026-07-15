import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  reset: () => void;
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
      setStep4: (date, timeSlot) => set({ date, timeSlot }),
      setStep5: (name, email, phone) => set({ name, email, phone }),

      // Commercial
      setCommercialStep1: (facilityType, sqftRange, address, city, zip) =>
        set({ facilityType, sqftRange, address, city, zip }),
      setCommercialStep2: (floors, serviceAreas, notes) =>
        set({ floors, serviceAreas, commercialNotes: notes }),
      setCommercialContact: (name, businessName, email, phone, frequency, schedulePreference) =>
        set({ name, businessName, email, phone, commercialFrequency: frequency, schedulePreference }),

      setSubmitting: (value) => set({ isSubmitting: value }),
      reset: () => set(defaultState),
    }),
    {
      name: "booking-store",
      storage: createJSONStorage(() => sessionStorage),
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
