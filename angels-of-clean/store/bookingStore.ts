import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ServiceType = "standard" | "deep" | "moveinout" | null;
export type Frequency = "one-time" | "weekly" | "bi-weekly" | "monthly" | null;
export type TimeSlot = "morning" | "afternoon" | null;

interface BookingState {
  // Step 1
  service: ServiceType;
  frequency: Frequency;

  // Step 2
  address: string;
  city: string;
  zip: string;

  // Step 3
  bedrooms: number;
  bathrooms: number;
  notes: string;

  // Step 4
  date: string;
  timeSlot: TimeSlot;

  // Step 5
  name: string;
  email: string;
  phone: string;

  // Submission
  isSubmitting: boolean;

  // Actions
  setStep1: (service: ServiceType, frequency: Frequency) => void;
  setStep2: (address: string, city: string, zip: string) => void;
  setStep3: (bedrooms: number, bathrooms: number, notes: string) => void;
  setStep4: (date: string, timeSlot: TimeSlot) => void;
  setStep5: (name: string, email: string, phone: string) => void;
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
      }),
    }
  )
);
