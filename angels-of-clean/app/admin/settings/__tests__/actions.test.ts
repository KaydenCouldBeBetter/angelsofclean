import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

const requireAdminMock = vi.fn();
vi.mock("@/lib/supabase/require-admin", () => ({ requireAdmin: () => requireAdminMock() }));

const rpc = vi.fn();
const updateUser = vi.fn();
const signInWithPassword = vi.fn();
const signOut = vi.fn();

import { changePassword, saveDisplayName, savePreferences, signOutOtherDevices } from "../actions";
import { DEFAULT_ADMIN_PREFERENCES } from "@/lib/admin-preferences";
import { FIELD_MAX_LENGTHS, PASSWORD_MIN_LENGTH } from "@/lib/constants";

const ADMIN = {
  ok: true,
  supabase: { rpc, auth: { updateUser, signInWithPassword, signOut } },
  user: { id: "admin-1", email: "admin@example.com" },
};

const PREFS = {
  landingPage: "calendar",
  calendarView: "month",
  weekStartsOn: "monday",
  calendarStartHour: 6,
  calendarEndHour: 20,
  unassignedListCollapsed: true,
  bookingsDefaultFilter: "upcoming",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue(ADMIN);
  rpc.mockResolvedValue({ data: { status: "saved" }, error: null });
  updateUser.mockResolvedValue({ error: null });
  signInWithPassword.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
});

// Every action is a directly callable endpoint, so each must refuse a visitor
// before doing anything.
describe("every settings action", () => {
  const actions: [string, () => Promise<unknown>][] = [
    ["savePreferences", () => savePreferences(PREFS)],
    ["saveDisplayName", () => saveDisplayName("Kay")],
    ["changePassword", () => changePassword({ currentPassword: "old password", newPassword: "new password 1" })],
    ["signOutOtherDevices", () => signOutOtherDevices()],
  ];

  it.each(actions)("%s refuses without an admin session and changes nothing", async (_name, run) => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "You are not authorized to do this." });
    expect(await run()).toEqual({ success: false, error: "You are not authorized to do this." });
    expect(rpc).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("savePreferences", () => {
  it("saves through the RPC with every value, and never a user id", async () => {
    expect(await savePreferences(PREFS)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("save_admin_preferences", {
      p_landing_page: "calendar",
      p_calendar_view: "month",
      p_week_starts_on: "monday",
      p_calendar_start_hour: 6,
      p_calendar_end_hour: 20,
      p_unassigned_list_collapsed: true,
      p_bookings_default_filter: "upcoming",
    });
  });

  it("ignores a user id the caller sneaks in", async () => {
    await savePreferences({ ...PREFS, user_id: "someone-else", userId: "someone-else" });
    const args = rpc.mock.calls[0][1];
    expect(JSON.stringify(args)).not.toContain("someone-else");
  });

  it("refreshes the pages that apply the preferences", async () => {
    await savePreferences(PREFS);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/calendar");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/bookings");
  });

  it("refuses invalid values before the database is touched", async () => {
    const result = await savePreferences({ ...PREFS, landingPage: "/evil" });
    expect(result.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();

    expect(await savePreferences({ ...PREFS, calendarStartHour: 10, calendarEndHour: 12 })).toEqual({
      success: false,
      error: "Show at least 4 hours on the calendar.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts the defaults", async () => {
    expect(await savePreferences(DEFAULT_ADMIN_PREFERENCES)).toEqual({ success: true });
  });

  it("gives a plain message, and logs only the code, when the save fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: "42P01", message: "table admin_preferences is missing" } });
    expect(await savePreferences(PREFS)).toEqual({ success: false, error: "Something went wrong. Please try again." });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("savePreferences failed", { code: "42P01", correlationId: expect.any(String) });
    expect(JSON.stringify(log.mock.calls)).not.toContain("is missing");
    log.mockRestore();
  });
});

describe("saveDisplayName", () => {
  it("saves the trimmed, single-spaced name to user_metadata", async () => {
    expect(await saveDisplayName("  Kay   Dee ")).toEqual({ success: true });
    expect(updateUser).toHaveBeenCalledWith({ data: { full_name: "Kay Dee" } });
  });

  it("lets the name be cleared", async () => {
    expect(await saveDisplayName("   ")).toEqual({ success: true });
    expect(updateUser).toHaveBeenCalledWith({ data: { full_name: "" } });
  });

  it("refuses a name that is too long or not text", async () => {
    expect(await saveDisplayName("a".repeat(FIELD_MAX_LENGTHS.name + 1))).toEqual({
      success: false,
      error: "That name is too long.",
    });
    expect((await saveDisplayName({ name: "x" })).success).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("logs no name when the update fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    updateUser.mockResolvedValue({ error: { code: "unexpected_failure", status: 500, message: "boom for Kay" } });
    expect((await saveDisplayName("Kay")).success).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain("Kay");
    log.mockRestore();
  });
});

describe("changePassword", () => {
  const input = { currentPassword: "old password", newPassword: "a brand new password" };

  it("checks the current password for this admin's own email, then sets the new one", async () => {
    expect(await changePassword(input)).toEqual({ success: true });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "admin@example.com", password: "old password" });
    expect(updateUser).toHaveBeenCalledWith({ password: "a brand new password" });
    expect(signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(updateUser.mock.invocationCallOrder[0]);
  });

  it("does not change anything when the current password is wrong", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid login credentials" } });
    expect(await changePassword(input)).toEqual({ success: false, error: "Your current password is incorrect." });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("says so when Supabase is rate limiting the check", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    signInWithPassword.mockResolvedValue({ error: { code: "over_request_rate_limit", status: 429, message: "x" } });
    const result = await changePassword(input);
    expect(result).toEqual({ success: false, error: "Too many attempts. Wait a few minutes and try again." });
    expect(updateUser).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("needs the current password", async () => {
    expect(await changePassword({ ...input, currentPassword: "" })).toEqual({
      success: false,
      error: "Enter your current password.",
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("refuses a new password that is too short or longer than bcrypt can use", async () => {
    expect((await changePassword({ ...input, newPassword: "x".repeat(PASSWORD_MIN_LENGTH - 1) })).success).toBe(false);
    expect((await changePassword({ ...input, newPassword: "x".repeat(73) })).success).toBe(false);
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses a new password equal to the current one", async () => {
    const same = "the same password";
    expect((await changePassword({ currentPassword: same, newPassword: same })).success).toBe(false);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("refuses malformed input", async () => {
    expect((await changePassword(null)).success).toBe(false);
    expect((await changePassword({ currentPassword: 1, newPassword: 2 })).success).toBe(false);
  });

  it("passes on Supabase's own rule for a weak password, and maps a repeat", async () => {
    updateUser.mockResolvedValue({ error: { code: "weak_password", message: "Password should contain a number." } });
    expect(await changePassword(input)).toEqual({ success: false, error: "Password should contain a number." });

    updateUser.mockResolvedValue({ error: { code: "same_password", message: "x" } });
    expect((await changePassword(input)).success).toBe(false);
  });

  it("never logs either password or the email", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    updateUser.mockResolvedValue({ error: { code: "unexpected_failure", status: 500, message: "failed for admin@example.com" } });
    await changePassword(input);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("old password");
    expect(logged).not.toContain("a brand new password");
    expect(logged).not.toContain("admin@example.com");
    log.mockRestore();
  });
});

describe("signOutOtherDevices", () => {
  it("ends the other sessions only, not this one", async () => {
    expect(await signOutOtherDevices()).toEqual({ success: true });
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("reports a failure plainly", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    signOut.mockResolvedValue({ error: { code: "unexpected_failure", status: 500, message: "x" } });
    expect(await signOutOtherDevices()).toEqual({ success: false, error: "Something went wrong. Please try again." });
    log.mockRestore();
  });
});
