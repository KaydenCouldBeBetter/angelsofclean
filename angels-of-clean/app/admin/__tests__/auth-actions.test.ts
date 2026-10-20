import { describe, it, expect, vi, beforeEach } from "vitest";

// next/navigation's redirect throws to end the request; mirror that.
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

let requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestHeaders),
}));

type AuthError = { code?: string; message: string } | null;
const resetPasswordForEmailMock = vi.fn<
  (email: string, options?: { redirectTo?: string }) => Promise<{ error: AuthError }>
>(() => Promise.resolve({ error: null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({ auth: { resetPasswordForEmail: resetPasswordForEmailMock } }),
}));

const updateUserMock = vi.fn<(attrs: { password: string }) => Promise<{ error: AuthError }>>(() =>
  Promise.resolve({ error: null }),
);
const requireAdminMock = vi.fn();
vi.mock("@/lib/supabase/require-admin", () => ({
  requireAdmin: () => requireAdminMock(),
}));

import { requestPasswordReset, updatePassword } from "../auth-actions";
import { FIELD_MAX_LENGTHS, PASSWORD_MIN_LENGTH } from "@/lib/constants";

const ADMIN = {
  ok: true,
  supabase: { auth: { updateUser: updateUserMock } },
  user: { email: "admin@example.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  requestHeaders = new Headers({ origin: "https://angelsofclean.example" });
  resetPasswordForEmailMock.mockResolvedValue({ error: null });
  updateUserMock.mockResolvedValue({ error: null });
  requireAdminMock.mockResolvedValue(ADMIN);
});

describe("requestPasswordReset", () => {
  it("asks Supabase to email a link that lands on the confirm route", async () => {
    const result = await requestPasswordReset("  jordan@example.com ");

    expect(result).toEqual({});
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("jordan@example.com", {
      redirectTo: "https://angelsofclean.example/admin/reset-password/confirm",
    });
  });

  it("leaves the redirect to Supabase's Site URL when the request has no origin", async () => {
    requestHeaders = new Headers();

    await requestPasswordReset("jordan@example.com");

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("jordan@example.com", undefined);
  });

  it.each([
    ["an invalid address", "not-an-email"],
    ["an empty address", "   "],
    ["an over-long address", `${"x".repeat(FIELD_MAX_LENGTHS.email)}@example.com`],
    ["a non-string", 42 as unknown as string],
  ])("rejects %s without contacting Supabase", async (_case, email) => {
    const result = await requestPasswordReset(email);

    expect(result).toEqual({ error: "Enter a valid email address." });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("explains when Supabase's email limit has been reached", async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      error: { code: "over_email_send_rate_limit", message: "email rate limit exceeded" },
    });

    const result = await requestPasswordReset("jordan@example.com");

    expect(result).toEqual({
      error: "Too many reset emails were requested. Wait a few minutes and try again.",
    });
  });

  it("logs only the error code, never the email, when the request fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    resetPasswordForEmailMock.mockResolvedValue({
      error: { code: "unexpected_failure", message: "failed for jordan@example.com" },
    });

    const result = await requestPasswordReset("jordan@example.com");

    expect(result).toEqual({ error: "Something went wrong. Please try again." });
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("unexpected_failure");
    expect(logged).not.toContain("jordan@example.com");
    consoleSpy.mockRestore();
  });
});

describe("updatePassword", () => {
  it("saves the new password and sends the admin to the dashboard", async () => {
    await expect(updatePassword("correct horse battery")).rejects.toThrow(
      "NEXT_REDIRECT:/admin/dashboard",
    );
    expect(updateUserMock).toHaveBeenCalledWith({ password: "correct horse battery" });
  });

  it("refuses without an admin session, without changing anything", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "You must be signed in to do this." });

    const result = await updatePassword("correct horse battery");

    expect(result).toEqual({ error: "Your reset link has expired. Request a new one." });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than the minimum", async () => {
    const result = await updatePassword("x".repeat(PASSWORD_MIN_LENGTH - 1));

    expect(result).toEqual({ error: `Use at least ${PASSWORD_MIN_LENGTH} characters.` });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejects a password longer than bcrypt can use (72 bytes)", async () => {
    // 25 three-byte characters = 75 bytes, though only 25 characters long.
    const result = await updatePassword("€".repeat(25));

    expect(result).toEqual({ error: "That password is too long. Use a shorter one." });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("explains when the new password is the same as the old one", async () => {
    updateUserMock.mockResolvedValue({
      error: { code: "same_password", message: "New password should be different" },
    });

    const result = await updatePassword("correct horse battery");

    expect(result).toEqual({ error: "Choose a password you haven't used for this account." });
  });

  it("passes on Supabase's own rule when the password is too weak", async () => {
    updateUserMock.mockResolvedValue({
      error: { code: "weak_password", message: "Password should contain a number." },
    });

    const result = await updatePassword("correct horse battery");

    expect(result).toEqual({ error: "Password should contain a number." });
  });
});
