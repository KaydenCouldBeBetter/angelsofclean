import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("../server", () => ({ createClient: () => createClient() }));

import { countBookingsOnDate, getBookingSettings, readBookingControls } from "../booking-settings";

const SETTINGS_ROW = {
  online_booking_paused: true,
  pause_message: "Back Monday.",
  min_notice_hours: 24,
  max_days_ahead: 30,
  updated_at: "2026-11-13T15:00:00Z",
  updated_by: "kay@example.com",
};

// A tiny query builder: every method returns the builder, and awaiting it (or
// calling maybeSingle) yields the configured result.
function builder(result: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "gte", "order", "limit", "eq", "neq"]) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
}

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("readBookingControls", () => {
  function client(over: { settings?: unknown; blackouts?: unknown; audit?: unknown } = {}) {
    const tables: Record<string, ReturnType<typeof builder>> = {
      booking_settings: builder(over.settings ?? { data: SETTINGS_ROW, error: null }),
      blackout_dates: builder(
        over.blackouts ?? { data: [{ day: "2026-11-26", label: "Thanksgiving", created_by: "kay@example.com" }], error: null },
      ),
      settings_audit: builder(
        over.audit ?? {
          data: [{ id: "a1", description: "Paused online booking", actor: "kay@example.com", created_at: "2026-11-13T15:00:00Z" }],
          error: null,
        },
      ),
    };
    return { tables, supabase: { from: vi.fn((t: string) => tables[t]) } };
  }

  it("returns the settings, the upcoming closed days and the audit trail", async () => {
    const { supabase } = client();
    expect(await readBookingControls(supabase as never, "2026-11-13")).toEqual({
      ok: true,
      data: {
        settings: {
          paused: true,
          pauseMessage: "Back Monday.",
          minNoticeHours: 24,
          maxDaysAhead: 30,
          updatedAt: "2026-11-13T15:00:00Z",
          updatedBy: "kay@example.com",
        },
        blackouts: [{ day: "2026-11-26", label: "Thanksgiving", createdBy: "kay@example.com" }],
        audit: [
          { id: "a1", description: "Paused online booking", actor: "kay@example.com", createdAt: "2026-11-13T15:00:00Z" },
        ],
      },
    });
  });

  it("asks only for closed days from today on, soonest first, and the latest 20 changes", async () => {
    const { supabase, tables } = client();
    await readBookingControls(supabase as never, "2026-11-13");
    expect(tables.blackout_dates.gte).toHaveBeenCalledWith("day", "2026-11-13");
    expect(tables.blackout_dates.order).toHaveBeenCalledWith("day", { ascending: true });
    expect(tables.settings_audit.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(tables.settings_audit.limit).toHaveBeenCalledWith(20);
  });

  it.each(["settings", "blackouts", "audit"] as const)(
    "fails as a whole, logging only the code, when the %s query fails",
    async (which) => {
      const { supabase } = client({ [which]: { data: null, error: { code: "42P01", message: "kay@example.com" } } });
      expect(await readBookingControls(supabase as never, "2026-11-13")).toEqual({ ok: false });
      expect(log).toHaveBeenCalledWith("readBookingControls failed", { code: "42P01", correlationId: expect.any(String) });
      expect(JSON.stringify(log.mock.calls)).not.toContain("kay@example.com");
    },
  );

  it("fails when there is no settings row, rather than inventing defaults", async () => {
    const { supabase } = client({ settings: { data: null, error: null } });
    expect(await readBookingControls(supabase as never, "2026-11-13")).toEqual({ ok: false });
  });
});

describe("getBookingSettings", () => {
  it("returns the settings row through the admin's own session", async () => {
    createClient.mockResolvedValue({ from: () => builder({ data: SETTINGS_ROW, error: null }) });
    const result = await getBookingSettings();
    expect(result.ok && result.data.paused).toBe(true);
  });

  it("is a failure, not 'open', when it can't be read", async () => {
    createClient.mockResolvedValue({ from: () => builder({ data: null, error: { code: "42P01" } }) });
    expect(await getBookingSettings()).toEqual({ ok: false });
  });
});

describe("countBookingsOnDate", () => {
  it("counts the day's bookings, leaving out cancelled ones", async () => {
    const b = builder({ count: 3, error: null });
    const supabase = { from: vi.fn(() => b) };
    expect(await countBookingsOnDate(supabase as never, "2026-11-26")).toEqual({ ok: true, data: 3 });
    expect(supabase.from).toHaveBeenCalledWith("bookings");
    expect(b.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(b.eq).toHaveBeenCalledWith("scheduled_date", "2026-11-26");
    expect(b.neq).toHaveBeenCalledWith("status", "cancelled");
  });

  it("reports zero as zero, and a failed query as a failure rather than zero", async () => {
    expect(await countBookingsOnDate({ from: () => builder({ count: 0, error: null }) } as never, "2026-11-26")).toEqual({
      ok: true,
      data: 0,
    });
    expect(await countBookingsOnDate({ from: () => builder({ count: null, error: { code: "42501" } }) } as never, "2026-11-26")).toEqual({
      ok: false,
    });
  });
});
