import { create } from "zustand";

type ServiceType = "standard" | "deep" | "moveinout" | null;
type Frequency = "one-time" | "weekly" | "bi-weekly" | "monthly" | null;
type TimeSlot = "morning" | "afternoon" | null;

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

  // Actions
  setStep1: (service: ServiceType, frequency: Frequency) => void;
  setStep2: (address: string, city: string, zip: string) => void;
  setStep3: (bedrooms: number, bathrooms: number, notes: string) => void;
  setStep4: (date: string, timeSlot: TimeSlot) => void;
  setStep5: (name: string, email: string, phone: string) => void;
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
};

export const useBookingStore = create<BookingState>((set) => ({
  ...defaultState,

  setStep1: (service, frequency) => set({ service, frequency }),
  setStep2: (address, city, zip) => set({ address, city, zip }),
  setStep3: (bedrooms, bathrooms, notes) => set({ bedrooms, bathrooms, notes }),
  setStep4: (date, timeSlot) => set({ date, timeSlot }),
  setStep5: (name, email, phone) => set({ name, email, phone }),
  reset: () => set(defaultState),
}));
