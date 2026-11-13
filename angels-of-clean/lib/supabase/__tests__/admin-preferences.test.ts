import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ADMIN_PREFERENCES } from "@/lib/admin-preferences";

const maybeSingle = vi.fn();
const select = vi.fn(() => ({ maybeSingle }));
const eq = vi.fn();
const from = vi.fn(() => ({ select }));
const createClient = vi.fn();
vi.mock("../server", () => ({ createClient: () => createClient() }));

import { getAdminPreferences, getAdminPreferencesOrDefaults, readAdminPreferences } from "../admin-preferences";

const ROW = {
  landing_page: "calendar",
  calendar_view: "month",
  week_starts_on: "monday",
  calendar_start_hour: 6,
  calendar_end_hour: 20,
  unassigned_list_collapsed: true,
  bookings_default_filter: "all",
};

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockResolvedValue({ from });
  maybeSingle.mockResolvedValue({ data: ROW, error: null });
});

describe("readAdminPreferences", () => {
  it("returns the saved preferences", async () => {
    expect(await readAdminPreferences({ from } as never)).toEqual({
      ok: true,
      data: {
        landingPage: "calendar",
        calendarView: "month",
        weekStartsOn: "monday",
        calendarStartHour: 6,
        calendarEndHour: 20,
        unassignedListCollapsed: true,
        bookingsDefaultFilter: "all",
      },
    });
  });

  it("asks for the preference columns only, never the user id", async () => {
    await readAdminPreferences({ from } as never);
    expect(from).toHaveBeenCalledWith("admin_preferences");
    const columns = (select.mock.calls[0] as unknown as [string])[0];
    expect(columns.split(",").sort()).toEqual(Object.keys(ROW).sort());
    // Row-level security picks the admin's own row; no id is passed that could be wrong.
    expect(eq).not.toHaveBeenCalled();
  });

  it("gives the defaults, as a success, to an admin who has never saved", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await readAdminPreferences({ from } as never)).toEqual({ ok: true, data: DEFAULT_ADMIN_PREFERENCES });
  });

  it("reports a failed query as a failure, never as 'no preferences', and logs only the code", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42P01", message: "table is missing for kay@example.com" } });
    expect(await readAdminPreferences({ from } as never)).toEqual({ ok: false });
    expect(log).toHaveBeenCalledWith("getAdminPreferences failed", { code: "42P01", correlationId: expect.any(String) });
    expect(JSON.stringify(log.mock.calls)).not.toContain("kay@example.com");
    log.mockRestore();
  });
});

describe("getAdminPreferencesOrDefaults", () => {
  it("returns the saved preferences", async () => {
    expect((await getAdminPreferencesOrDefaults()).landingPage).toBe("calendar");
  });

  it("falls back to the defaults on a failed query", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42P01" } });
    expect(await getAdminPreferencesOrDefaults()).toEqual(DEFAULT_ADMIN_PREFERENCES);
    log.mockRestore();
  });

  it("falls back to the defaults if the lookup throws", async () => {
    maybeSingle.mockRejectedValue(new Error("network down"));
    expect(await getAdminPreferencesOrDefaults()).toEqual(DEFAULT_ADMIN_PREFERENCES);
    createClient.mockRejectedValue(new Error("no cookies"));
    expect(await getAdminPreferencesOrDefaults()).toEqual(DEFAULT_ADMIN_PREFERENCES);
  });
});

describe("getAdminPreferences", () => {
  it("uses the request's own session client", async () => {
    await getAdminPreferences();
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
