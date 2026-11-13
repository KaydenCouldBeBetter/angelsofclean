import { beforeEach, describe, expect, it, vi } from "vitest";

// L2: a customer who types their (valid) login into the admin portal is refused.
// That refusal must end only this browser's session, not sign them out of the
// customer portal on every other device.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));

const signInWithPassword = vi.fn();
const signOut = vi.fn(() => Promise.resolve({ error: null }));
// The admin's own start page is read with the same session, right after sign-in.
const maybeSingle = vi.fn();
const from = vi.fn(() => ({ select: () => ({ maybeSingle }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { signInWithPassword, signOut }, from }),
}));
vi.mock("@/lib/supabase/require-admin", () => ({ requireAdmin: vi.fn() }));

import { signIn } from "../auth-actions";

beforeEach(() => {
  vi.clearAllMocks();
  maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("admin signIn with a customer's credentials", () => {
  it("refuses, and signs out this browser only", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: {} } }, error: null });
    expect(await signIn("ann@example.com", "a valid password")).toEqual({
      error: "This account is not authorized for the admin portal.",
    });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("still lets an admin through to the dashboard", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: { role: "admin" } } }, error: null });
    await expect(signIn("admin@example.com", "a valid password")).rejects.toThrow("NEXT_REDIRECT:/admin/dashboard");
    expect(signOut).not.toHaveBeenCalled();
  });
});

const ADMIN = { data: { user: { app_metadata: { role: "admin" } } }, error: null };
const prefsRow = (landing_page: string) => ({
  data: {
    landing_page,
    calendar_view: "week",
    week_starts_on: "sunday",
    calendar_start_hour: 7,
    calendar_end_hour: 17,
    unassigned_list_collapsed: false,
    bookings_default_filter: "today",
  },
  error: null,
});

describe("admin signIn start page", () => {
  beforeEach(() => signInWithPassword.mockResolvedValue(ADMIN));

  it.each([
    ["calendar", "/admin/calendar"],
    ["bookings", "/admin/bookings"],
    ["dashboard", "/admin/dashboard"],
  ])("lands an admin who chose %s on %s", async (choice, path) => {
    maybeSingle.mockResolvedValue(prefsRow(choice));
    await expect(signIn("admin@example.com", "a valid password")).rejects.toThrow(`NEXT_REDIRECT:${path}`);
    expect(from).toHaveBeenCalledWith("admin_preferences");
  });

  it("lands an admin with nothing saved on the dashboard", async () => {
    await expect(signIn("admin@example.com", "a valid password")).rejects.toThrow("NEXT_REDIRECT:/admin/dashboard");
  });

  it("still signs in, on the dashboard, when the preferences can't be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42P01" } });
    await expect(signIn("admin@example.com", "a valid password")).rejects.toThrow("NEXT_REDIRECT:/admin/dashboard");
    maybeSingle.mockRejectedValue(new Error("network down"));
    await expect(signIn("admin@example.com", "a valid password")).rejects.toThrow("NEXT_REDIRECT:/admin/dashboard");
    log.mockRestore();
  });

  it("never reads preferences for an account that isn't an admin", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: {} } }, error: null });
    await signIn("ann@example.com", "a valid password");
    expect(from).not.toHaveBeenCalled();
  });

  it("never reads preferences when the password is wrong", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });
    expect(await signIn("admin@example.com", "nope")).toEqual({ error: "Invalid email or password." });
    expect(from).not.toHaveBeenCalled();
  });
});
