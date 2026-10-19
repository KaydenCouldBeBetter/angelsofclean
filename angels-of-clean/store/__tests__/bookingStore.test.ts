import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useBookingStore, isSavedDateExpired } from "@/store/bookingStore";

describe("bookingStore", () => {
  beforeEach(() => {
    useBookingStore.getState().reset();
  });

  it("initializes with null/empty defaults", () => {
    const state = useBookingStore.getState();
    expect(state.service).toBeNull();
    expect(state.frequency).toBeNull();
    expect(state.address).toBe("");
    expect(state.accessInstructions).toBe("");
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

  it("setStep3 sets bedrooms, bathrooms, notes, and entry instructions", () => {
    useBookingStore.getState().setStep3(3, 2, "Skip the basement", "Gate code 4412");
    const state = useBookingStore.getState();
    expect(state.bedrooms).toBe(3);
    expect(state.bathrooms).toBe(2);
    expect(state.notes).toBe("Skip the basement");
    expect(state.accessInstructions).toBe("Gate code 4412");
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
    useBookingStore.getState().setStep3(4, 3, "Use unscented products", "Side door, code 1234");
    useBookingStore.getState().setStep4("2026-08-01", "morning");
    useBookingStore.getState().setStep5("John Doe", "john@test.com", "315-555-0200");
    useBookingStore.getState().setSubmitting(true);

    // Reset
    useBookingStore.getState().reset();
    const state = useBookingStore.getState();

    expect(state.service).toBeNull();
    expect(state.frequency).toBeNull();
    expect(state.address).toBe("");
    expect(state.accessInstructions).toBe("");
    expect(state.name).toBe("");
    expect(state.isSubmitting).toBe(false);
  });
});

// 2026-07-15 10:00 AM in New York (EDT).
const NOW = new Date("2026-07-15T14:00:00Z");

function saveToSession(state: Record<string, unknown>) {
  sessionStorage.setItem("booking-store", JSON.stringify({ state, version: 0 }));
}

describe("isSavedDateExpired", () => {
  it("never expires an empty date", () => {
    expect(isSavedDateExpired("", null, NOW)).toBe(false);
    expect(isSavedDateExpired("", "morning", NOW)).toBe(false);
  });

  it("expires a past day, with or without a slot", () => {
    expect(isSavedDateExpired("2026-07-14", null, NOW)).toBe(true);
    expect(isSavedDateExpired("2026-07-14", "afternoon", NOW)).toBe(true);
  });

  it("keeps a future day", () => {
    expect(isSavedDateExpired("2026-07-16", "morning", NOW)).toBe(false);
    expect(isSavedDateExpired("2026-07-16", null, NOW)).toBe(false);
  });

  it("expires today only once the chosen slot has started", () => {
    expect(isSavedDateExpired("2026-07-15", "morning", NOW)).toBe(true);
    expect(isSavedDateExpired("2026-07-15", "afternoon", NOW)).toBe(false);
  });

  it("keeps today when no slot is chosen, since a later slot may be open", () => {
    expect(isSavedDateExpired("2026-07-15", null, NOW)).toBe(false);
  });

  it("expires a malformed or impossible date", () => {
    expect(isSavedDateExpired("tomorrow", null, NOW)).toBe(true);
    expect(isSavedDateExpired("2026-02-30", "morning", NOW)).toBe(true);
  });
});

describe("saved wizard state on load", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    useBookingStore.getState().reset();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const SAVED = {
    service: "deep",
    address: "1 Test St",
    city: "Cicero",
    zip: "13039",
    name: "Jane Doe",
    timeSlot: "afternoon",
  };

  it("does not revive a date that has passed, and flags it", async () => {
    saveToSession({ ...SAVED, date: "2026-07-10" });

    await useBookingStore.persist.rehydrate();

    const state = useBookingStore.getState();
    expect(state.date).toBe("");
    expect(state.dateExpired).toBe(true);
  });

  it("keeps everything else the customer entered, slot included", async () => {
    saveToSession({ ...SAVED, date: "2026-07-10" });

    await useBookingStore.persist.rehydrate();

    const state = useBookingStore.getState();
    expect(state.service).toBe("deep");
    expect(state.address).toBe("1 Test St");
    expect(state.name).toBe("Jane Doe");
    expect(state.timeSlot).toBe("afternoon");
  });

  it("clears today's date when its saved slot has already started", async () => {
    saveToSession({ ...SAVED, date: "2026-07-15", timeSlot: "morning" });

    await useBookingStore.persist.rehydrate();

    expect(useBookingStore.getState().date).toBe("");
    expect(useBookingStore.getState().dateExpired).toBe(true);
  });

  it("revives a date that is still bookable", async () => {
    saveToSession({ ...SAVED, date: "2026-07-20" });

    await useBookingStore.persist.rehydrate();

    const state = useBookingStore.getState();
    expect(state.date).toBe("2026-07-20");
    expect(state.dateExpired).toBe(false);
  });

  it("does not flag a customer who never chose a date", async () => {
    saveToSession({ ...SAVED, date: "" });

    await useBookingStore.persist.rehydrate();

    expect(useBookingStore.getState().dateExpired).toBe(false);
  });

  it("never writes the flag to sessionStorage", async () => {
    saveToSession({ ...SAVED, date: "2026-07-10" });
    await useBookingStore.persist.rehydrate();

    useBookingStore.getState().setStep5("Jane Doe", "jane@example.com", "(315) 555-0100");

    expect(sessionStorage.getItem("booking-store")).not.toContain("dateExpired");
  });

  it("choosing a new date clears the flag", async () => {
    saveToSession({ ...SAVED, date: "2026-07-10" });
    await useBookingStore.persist.rehydrate();

    useBookingStore.getState().setStep4("2026-07-20", "morning");

    expect(useBookingStore.getState().dateExpired).toBe(false);
  });

  it("clearDateExpired() and reset() drop the flag", () => {
    useBookingStore.setState({ dateExpired: true });
    useBookingStore.getState().clearDateExpired();
    expect(useBookingStore.getState().dateExpired).toBe(false);

    useBookingStore.setState({ dateExpired: true });
    useBookingStore.getState().reset();
    expect(useBookingStore.getState().dateExpired).toBe(false);
  });
});
