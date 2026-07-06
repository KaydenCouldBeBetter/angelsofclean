import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ServiceType = "standard" | "deep" | "moveinout" | null;
export type Frequency = "one-time" | "weekly" | "bi-weekly" | "monthly" | null;
export type TimeSlot = "morning" | "afternoon" | null;
export type FacilityType = "office" | "retail" | "medical" | "warehouse/shop" | "other" | null;
export type SqftRange = "small" | "medium" | "large" | "enterprise" | null; // Placeholders to be replaced by actual values


interface BookingState {
  // Residential Step 1
  service: ServiceType;
  frequency: Frequency;

  // Residential Step 2
  address: string;
  city: string;
  zip: string;

  // Residential Step 3
  bedrooms: number;
  bathrooms: number;
  notes: string;

  // Residential Step 4
  date: string;
  timeSlot: TimeSlot;

  // Residential Step 5
  name: string;
  email: string;
  phone: string;

  // Submission
  isSubmitting: boolean;

  //Commercial Step 1
  facilityType: FacilityType

  //Commercial Step 2
  sqftRange: SqftRange
  restrooms: number

  //Commercial Step 3
  businessName: string;

  // Actions
  setStep1: (service: ServiceType, frequency: Frequency) => void;
  setStep2: (address: string, city: string, zip: string) => void;
  setStep3: (bedrooms: number, bathrooms: number, notes: string) => void;
  setStep4: (date: string, timeSlot: TimeSlot) => void;
  setStep5: (name: string, email: string, phone: string) => void;
  setCommercialStep1: (facilityType: FacilityType) => void;
  setCommercialStep2: (sqftRange: SqftRange, restrooms: number) => void;
  setCommercialStep3: (businessName: string, frequency: Frequency, notes: string) => void;
  setSubmitting: (value: boolean) => void;
  reset: () => void;
}

const defaultState = {
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
  facilityType: null as FacilityType,
  sqftRange: null as SqftRange,
  restrooms: 1,
  businessName: "",
  isSubmitting: false,
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
      ...defaultState,

      setStep1: (service, frequency) => set({ service, frequency }),
      setStep2: (address, city, zip) => set({ address, city, zip }),
      setStep3: (bedrooms, bathrooms, notes) => set({ bedrooms, bathrooms, notes }),
      setStep4: (date, timeSlot) => set({ date, timeSlot }),
      setStep5: (name, email, phone) => set({ name, email, phone }),
      setCommercialStep1: (facilityType) => set({ facilityType }),
      setCommercialStep2: (sqftRange, restrooms) => set({ sqftRange, restrooms }),
      setCommercialStep3: (businessName, frequency, notes) => set({ businessName, frequency, notes }),
      setSubmitting: (value) => set({ isSubmitting: value }),
      reset: () => set(defaultState),
    }),
    {
      name: "booking-store",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
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
        facilityType: state.facilityType,
        sqftRange: state.sqftRange,
        restrooms: state.restrooms,
        businessName: state.businessName,
      }),
    }
  )
);
