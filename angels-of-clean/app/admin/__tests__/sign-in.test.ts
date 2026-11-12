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
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { signInWithPassword, signOut } }),
}));
vi.mock("@/lib/supabase/require-admin", () => ({ requireAdmin: vi.fn() }));

import { signIn } from "../auth-actions";

beforeEach(() => vi.clearAllMocks());

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
