import { describe, it, expect, beforeEach } from "vitest";
import { useBookingStore } from "@/store/bookingStore";

describe("bookingStore", () => {
  beforeEach(() => {
    useBookingStore.getState().reset();
  });

  it("initializes with null/empty defaults", () => {
    const state = useBookingStore.getState();
    expect(state.service).toBeNull();
    expect(state.frequency).toBeNull();
    expect(state.address).toBe("");
    expect(state.city).toBe("");
    expect(state.zip).toBe("");
    expect(state.bedrooms).toBe(2);
    expect(state.bathrooms).toBe(1);
    expect(state.notes).toBe("");
    expect(state.date).toBe("");
    expect(state.timeSlot).toBeNull();
    expect(state.name).toBe("");
    expect(state.email).toBe("");
    expect(state.phone).toBe("");
    expect(state.isSubmitting).toBe(false);
  });

  it("setStep1 sets service and frequency", () => {
    useBookingStore.getState().setStep1("deep", "weekly");
    const state = useBookingStore.getState();
    expect(state.service).toBe("deep");
    expect(state.frequency).toBe("weekly");
  });

  it("setStep2 sets address, city, and zip", () => {
    useBookingStore.getState().setStep2("123 Main St", "Syracuse", "13202");
    const state = useBookingStore.getState();
    expect(state.address).toBe("123 Main St");
    expect(state.city).toBe("Syracuse");
    expect(state.zip).toBe("13202");
  });

  it("setStep3 sets bedrooms, bathrooms, and notes", () => {
    useBookingStore.getState().setStep3(3, 2, "Two dogs");
    const state = useBookingStore.getState();
    expect(state.bedrooms).toBe(3);
    expect(state.bathrooms).toBe(2);
    expect(state.notes).toBe("Two dogs");
  });

  it("setStep4 sets date and timeSlot", () => {
    useBookingStore.getState().setStep4("2026-07-10", "afternoon");
    const state = useBookingStore.getState();
    expect(state.date).toBe("2026-07-10");
    expect(state.timeSlot).toBe("afternoon");
  });

  it("setStep5 sets name, email, and phone", () => {
    useBookingStore.getState().setStep5("Jane Doe", "jane@example.com", "315-555-0100");
    const state = useBookingStore.getState();
    expect(state.name).toBe("Jane Doe");
    expect(state.email).toBe("jane@example.com");
    expect(state.phone).toBe("315-555-0100");
  });

  it("setSubmitting sets isSubmitting flag", () => {
    useBookingStore.getState().setSubmitting(true);
    expect(useBookingStore.getState().isSubmitting).toBe(true);
    useBookingStore.getState().setSubmitting(false);
    expect(useBookingStore.getState().isSubmitting).toBe(false);
  });

  it("reset() returns all values to defaults", () => {
    // Set all steps
    useBookingStore.getState().setStep1("moveinout", "monthly");
    useBookingStore.getState().setStep2("456 Elm St", "Liverpool", "13088");
    useBookingStore.getState().setStep3(4, 3, "Use unscented products");
    useBookingStore.getState().setStep4("2026-08-01", "morning");
    useBookingStore.getState().setStep5("John Doe", "john@test.com", "315-555-0200");
    useBookingStore.getState().setSubmitting(true);

    // Reset
    useBookingStore.getState().reset();
    const state = useBookingStore.getState();

    expect(state.service).toBeNull();
    expect(state.frequency).toBeNull();
    expect(state.address).toBe("");
    expect(state.name).toBe("");
    expect(state.isSubmitting).toBe(false);
  });
});
