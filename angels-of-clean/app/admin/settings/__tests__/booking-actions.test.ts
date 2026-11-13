import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

const requireAdminMock = vi.fn();
vi.mock("@/lib/supabase/require-admin", () => ({ requireAdmin: () => requireAdminMock() }));

const countBookingsOnDate = vi.fn();
vi.mock("@/lib/supabase/booking-settings", () => ({
  countBookingsOnDate: (...a: unknown[]) => countBookingsOnDate(...a),
}));

const rpc = vi.fn();

import { addBlackoutDate, previewBlackoutDate, removeBlackoutDate, saveBookingSettings } from "../booking-actions";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";

const ADMIN = { ok: true, supabase: { rpc, marker: "admin session" }, user: { email: "kay@example.com" } };
const SETTINGS = { paused: true, pauseMessage: "  Back Monday. ", minNoticeHours: 24, maxDaysAhead: 30 };
// A date comfortably inside the two-year window, whatever day the tests run.
const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN);
  rpc.mockResolvedValue({ data: { status: "added" }, error: null });
  countBookingsOnDate.mockResolvedValue({ ok: true, data: 2 });
});

describe("every online booking action", () => {
  const actions: [string, () => Promise<unknown>][] = [
    ["saveBookingSettings", () => saveBookingSettings(SETTINGS)],
    ["addBlackoutDate", () => addBlackoutDate({ day: FUTURE, label: "" })],
    ["removeBlackoutDate", () => removeBlackoutDate(FUTURE)],
    ["previewBlackoutDate", () => previewBlackoutDate(FUTURE)],
  ];

  it.each(actions)("%s refuses without an admin session and changes nothing", async (_name, run) => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "You are not authorized to do this." });
    expect(await run()).toEqual({ success: false, error: "You are not authorized to do this." });
    expect(rpc).not.toHaveBeenCalled();
    expect(countBookingsOnDate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveBookingSettings", () => {
  beforeEach(() => rpc.mockResolvedValue({ data: { status: "saved", changes: ["Paused online booking"] }, error: null }));

  it("saves through the RPC with the trimmed message", async () => {
    expect(await saveBookingSettings(SETTINGS)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("save_booking_settings", {
      p_paused: true,
      p_pause_message: "Back Monday.",
      p_min_notice_hours: 24,
      p_max_days_ahead: 30,
    });
  });

  it("refreshes the Settings page and the dashboard banner", async () => {
    await saveBookingSettings(SETTINGS);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("counts 'unchanged' as success", async () => {
    rpc.mockResolvedValue({ data: { status: "unchanged" }, error: null });
    expect(await saveBookingSettings(SETTINGS)).toEqual({ success: true });
  });

  it("refuses invalid values before the database is touched", async () => {
    for (const bad of [
      { ...SETTINGS, minNoticeHours: 5 },
      { ...SETTINGS, maxDaysAhead: 500 },
      { ...SETTINGS, paused: "yes" },
      { ...SETTINGS, pauseMessage: "a".repeat(FIELD_MAX_LENGTHS.pauseMessage + 1) },
      null,
    ]) {
      expect((await saveBookingSettings(bad)).success).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("gives a plain message, and logs only the code, when the save fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied for kay@example.com" } });
    expect(await saveBookingSettings(SETTINGS)).toEqual({ success: false, error: "Something went wrong. Please try again." });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("saveBookingSettings failed", { code: "42501", correlationId: expect.any(String) });
    expect(JSON.stringify(log.mock.calls)).not.toContain("kay@example.com");
    log.mockRestore();
  });
});

describe("addBlackoutDate", () => {
  it("closes the day through the RPC, with the trimmed label", async () => {
    expect(await addBlackoutDate({ day: FUTURE, label: "  Christmas " })).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("add_blackout_date", { p_day: FUTURE, p_label: "Christmas" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
  });

  it.each([
    ["exists", "That date is already closed."],
    ["past", "That date has already passed."],
    ["too_far", "Choose a date within the next two years."],
  ])("explains a %s answer", async (status, error) => {
    rpc.mockResolvedValue({ data: { status }, error: null });
    expect(await addBlackoutDate({ day: FUTURE, label: "" })).toEqual({ success: false, error });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a bad date or label before the database is touched", async () => {
    for (const bad of [
      { day: "2020-01-01", label: "" },
      { day: "2026-02-31", label: "" },
      { day: FUTURE, label: "a".repeat(FIELD_MAX_LENGTHS.blackoutLabel + 1) },
      { day: 20261225, label: "" },
      null,
    ]) {
      expect((await addBlackoutDate(bad)).success).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("logs only the code when it fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "Thanksgiving duplicate" } });
    expect((await addBlackoutDate({ day: FUTURE, label: "Thanksgiving" })).success).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain("Thanksgiving");
    log.mockRestore();
  });
});

describe("removeBlackoutDate", () => {
  it("reopens the day through the RPC", async () => {
    rpc.mockResolvedValue({ data: { status: "removed" }, error: null });
    expect(await removeBlackoutDate(FUTURE)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("remove_blackout_date", { p_day: FUTURE });
  });

  it("treats a day that is already open as done, not as an error", async () => {
    rpc.mockResolvedValue({ data: { status: "not_found" }, error: null });
    expect(await removeBlackoutDate(FUTURE)).toEqual({ success: true });
  });

  it("refuses anything that isn't a real date, without calling the database", async () => {
    for (const bad of ["soon", "2026-02-31", "", 5, null, { day: FUTURE }]) {
      expect((await removeBlackoutDate(bad)).success).toBe(false);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("previewBlackoutDate", () => {
  it("returns how many bookings the day has, using the admin's session", async () => {
    expect(await previewBlackoutDate("2026-11-26")).toEqual({ success: true, bookings: 2 });
    expect(countBookingsOnDate).toHaveBeenCalledWith(ADMIN.supabase, "2026-11-26");
  });

  it("reports a failed count as an error, not as zero bookings", async () => {
    countBookingsOnDate.mockResolvedValue({ ok: false });
    expect(await previewBlackoutDate("2026-11-26")).toEqual({ success: false, error: "Something went wrong. Please try again." });
  });

  it("refuses a bad date before querying", async () => {
    expect((await previewBlackoutDate("not a date")).success).toBe(false);
    expect(countBookingsOnDate).not.toHaveBeenCalled();
  });
});
