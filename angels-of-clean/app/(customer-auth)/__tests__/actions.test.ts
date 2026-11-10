import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

let requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(requestHeaders) }));

type AuthError = { code?: string; message: string } | null;
const signInWithPassword = vi.fn<() => Promise<{ data: { user: unknown }; error: AuthError }>>();
const signUp = vi.fn<
  (args: { email: string; password: string; options: Record<string, unknown> }) => Promise<{
    data: { session: unknown };
    error: AuthError;
  }>
>();
const resend = vi.fn<() => Promise<{ error: AuthError }>>();
const resetPasswordForEmail = vi.fn<
  (email: string, options?: { redirectTo?: string }) => Promise<{ error: AuthError }>
>();
const signOutMock = vi.fn(() => Promise.resolve({ error: null }));
const supabase = {
  auth: { signInWithPassword, signUp, resend, resetPasswordForEmail, signOut: signOutMock },
};
vi.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(supabase) }));

const requireCustomerMock = vi.fn();
vi.mock("@/lib/supabase/require-customer", () => ({ requireCustomer: () => requireCustomerMock() }));

const completeCustomerSignIn = vi.fn();
vi.mock("@/lib/supabase/customer-session", () => ({
  completeCustomerSignIn: (...args: unknown[]) => completeCustomerSignIn(...args),
}));

const allowPublicSubmission = vi.fn<(kind: string) => Promise<boolean>>();
vi.mock("@/lib/rate-limit", () => ({
  allowPublicSubmission: (kind: string) => allowPublicSubmission(kind),
}));

import {
  customerSignIn,
  customerSignOut,
  customerSignUp,
  requestCustomerPasswordReset,
  resendConfirmation,
  updateCustomerPassword,
  type SignUpInput,
} from "../actions";
import { FIELD_MAX_LENGTHS, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { MIN_FILL_MS } from "@/lib/bot-check";

const TOKEN = "B".repeat(43);
const VALID_SIGNUP: SignUpInput = {
  name: "Alice Adams",
  email: "alice@example.com",
  password: "correct horse",
  accountType: "residential",
  botCheck: { website: "", elapsedMs: MIN_FILL_MS + 1000 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  requestHeaders = new Headers({ origin: "https://angelsofclean.example" });
  allowPublicSubmission.mockResolvedValue(true);
  signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: {} } }, error: null });
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  resend.mockResolvedValue({ error: null });
  resetPasswordForEmail.mockResolvedValue({ error: null });
  completeCustomerSignIn.mockResolvedValue({ destination: "/account" });
  requireCustomerMock.mockResolvedValue({
    ok: true,
    supabase: { auth: { updateUser: vi.fn(() => Promise.resolve({ error: null })) } },
    user: { id: "u1" },
  });
});

describe("customerSignIn", () => {
  it("signs a customer in and goes where completing sign-in says", async () => {
    await expect(customerSignIn(" alice@example.com ", "pw")).rejects.toThrow("NEXT_REDIRECT:/account");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "alice@example.com", password: "pw" });
    expect(completeCustomerSignIn).toHaveBeenCalledWith(supabase, null);
  });

  it("passes a well-formed invite token on, and ignores a malformed one", async () => {
    await expect(customerSignIn("a@example.com", "pw", TOKEN)).rejects.toThrow("NEXT_REDIRECT");
    expect(completeCustomerSignIn).toHaveBeenLastCalledWith(supabase, TOKEN);
    await expect(customerSignIn("a@example.com", "pw", "nope")).rejects.toThrow("NEXT_REDIRECT");
    expect(completeCustomerSignIn).toHaveBeenLastCalledWith(supabase, null);
  });

  it("sends an admin to their own portal without touching customer records", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { app_metadata: { role: "admin" } } },
      error: null,
    });
    await expect(customerSignIn("boss@example.com", "pw")).rejects.toThrow(
      "NEXT_REDIRECT:/admin/dashboard",
    );
    expect(completeCustomerSignIn).not.toHaveBeenCalled();
  });

  it("gives one answer for a wrong password and an unknown email", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });
    expect(await customerSignIn("alice@example.com", "bad")).toEqual({
      error: "Invalid email or password.",
    });
  });

  it("asks an unconfirmed customer to confirm, with a way to resend", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    const result = await customerSignIn("alice@example.com", "pw");
    expect(result.needsConfirmation).toBe(true);
    expect(result.error).toMatch(/confirm your email/i);
  });

  it("explains Supabase's sign-in rate limit", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "over_request_rate_limit", message: "slow down" },
    });
    expect((await customerSignIn("alice@example.com", "pw")).error).toMatch(/too many attempts/i);
  });

  it.each([["not-an-email", "pw"], ["alice@example.com", ""], [42 as unknown as string, "pw"]])(
    "rejects bad input (%j) without contacting Supabase",
    async (email, password) => {
      expect(await customerSignIn(email, password)).toEqual({ error: "Invalid email or password." });
      expect(signInWithPassword).not.toHaveBeenCalled();
    },
  );
});

describe("customerSignUp", () => {
  it("asks Supabase to email a link to our confirm route, carrying only labels", async () => {
    expect(await customerSignUp(VALID_SIGNUP)).toEqual({ checkEmail: true });
    expect(signUp).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "correct horse",
      options: {
        emailRedirectTo: "https://angelsofclean.example/auth/confirm",
        data: { name: "Alice Adams", account_type: "residential" },
      },
    });
  });

  it("carries a business signup's type and an invite token in the metadata", async () => {
    await customerSignUp({ ...VALID_SIGNUP, accountType: "commercial", inviteToken: TOKEN });
    expect(signUp.mock.calls[0][0].options.data).toEqual({
      name: "Alice Adams",
      account_type: "commercial",
      invite_token: TOKEN,
    });
  });

  it("refuses a malformed invite token instead of dropping it silently", async () => {
    const result = await customerSignUp({ ...VALID_SIGNUP, inviteToken: "nope" });
    expect(result.error).toMatch(/invite link/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("goes straight in when Supabase returns a session (confirmation off in development)", async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });
    await expect(customerSignUp(VALID_SIGNUP)).rejects.toThrow("NEXT_REDIRECT:/account");
    expect(completeCustomerSignIn).toHaveBeenCalledWith(supabase, null);
  });

  it("looks identical when the email already has an account", async () => {
    // With confirmation on, Supabase answers success with no session for a
    // taken address too; the action must not add anything that tells them apart.
    expect(await customerSignUp(VALID_SIGNUP)).toEqual(await customerSignUp(VALID_SIGNUP));
  });

  describe("bot check", () => {
    it.each([
      ["a filled honeypot", { website: "http://spam.example", elapsedMs: 60_000 }],
      ["a submit that is too fast", { website: "", elapsedMs: MIN_FILL_MS - 1 }],
      ["a missing check", undefined],
      ["a malformed check", { website: "", elapsedMs: "fast" }],
    ])("answers %s with the generic error, before anything else", async (_case, botCheck) => {
      const result = await customerSignUp({
        ...VALID_SIGNUP,
        botCheck: botCheck as SignUpInput["botCheck"],
      });
      expect(result).toEqual({ error: "Something went wrong. Please try again." });
      expect(allowPublicSubmission).not.toHaveBeenCalled();
      expect(signUp).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it.each([
      ["a blank name", { name: "   " }, "Enter your name."],
      ["an over-long name", { name: "x".repeat(FIELD_MAX_LENGTHS.name + 1) }, "That name is too long."],
      ["a bad email", { email: "nope" }, "Enter a valid email address."],
      ["a short password", { password: "x".repeat(PASSWORD_MIN_LENGTH - 1) }, `Use at least ${PASSWORD_MIN_LENGTH} characters.`],
      ["a password over bcrypt's 72 bytes", { password: "x".repeat(73) }, "That password is too long. Use a shorter one."],
    ])("refuses %s without contacting Supabase", async (_case, patch, error) => {
      expect(await customerSignUp({ ...VALID_SIGNUP, ...patch })).toEqual({ error });
      expect(signUp).not.toHaveBeenCalled();
    });

    it("refuses an account type it doesn't know", async () => {
      const result = await customerSignUp({
        ...VALID_SIGNUP,
        accountType: "admin" as unknown as "residential",
      });
      expect(result.error).toBeTruthy();
      expect(signUp).not.toHaveBeenCalled();
    });
  });

  it("is rate limited per IP, and only after the input is valid", async () => {
    await customerSignUp({ ...VALID_SIGNUP, email: "nope" });
    expect(allowPublicSubmission).not.toHaveBeenCalled();

    allowPublicSubmission.mockResolvedValue(false);
    const result = await customerSignUp(VALID_SIGNUP);
    expect(allowPublicSubmission).toHaveBeenCalledWith("signup");
    expect(result.error).toMatch(/several requests/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("shows Supabase's own words for a weak password", async () => {
    signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "weak_password", message: "Password is known to be weak." },
    });
    expect(await customerSignUp(VALID_SIGNUP)).toEqual({ error: "Password is known to be weak." });
  });

  it("logs only the error code, never the email or name", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: { code: "unexpected_failure", message: "alice@example.com broke" } });
    await customerSignUp(VALID_SIGNUP);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("unexpected_failure");
    expect(logged).not.toContain("alice");
  });
});

describe("resendConfirmation", () => {
  it("resends to our confirm route, rate limited as a sign-up", async () => {
    expect(await resendConfirmation("alice@example.com")).toEqual({});
    expect(allowPublicSubmission).toHaveBeenCalledWith("signup");
    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "alice@example.com",
      options: { emailRedirectTo: "https://angelsofclean.example/auth/confirm" },
    });
  });

  it("validates the address and respects the rate limit", async () => {
    expect(await resendConfirmation("nope")).toEqual({ error: "Enter a valid email address." });
    allowPublicSubmission.mockResolvedValue(false);
    expect((await resendConfirmation("alice@example.com")).error).toMatch(/several requests/i);
    expect(resend).not.toHaveBeenCalled();
  });
});

describe("requestCustomerPasswordReset", () => {
  it("emails a link that lands on the customer recovery route", async () => {
    expect(await requestCustomerPasswordReset(" alice@example.com ")).toEqual({});
    expect(allowPublicSubmission).toHaveBeenCalledWith("reset");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("alice@example.com", {
      redirectTo: "https://angelsofclean.example/auth/recovery",
    });
  });

  it("leaves the redirect to Supabase's Site URL when the request has no origin", async () => {
    requestHeaders = new Headers();
    await requestCustomerPasswordReset("alice@example.com");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("alice@example.com", { redirectTo: undefined });
  });

  it("rejects a bad address and a rate-limited caller without contacting Supabase", async () => {
    expect(await requestCustomerPasswordReset("nope")).toEqual({ error: "Enter a valid email address." });
    allowPublicSubmission.mockResolvedValue(false);
    expect((await requestCustomerPasswordReset("alice@example.com")).error).toMatch(/several requests/i);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("explains Supabase's email limit", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { code: "over_email_send_rate_limit", message: "email rate limit exceeded" },
    });
    expect((await requestCustomerPasswordReset("alice@example.com")).error).toMatch(/too many reset emails/i);
  });
});

describe("updateCustomerPassword", () => {
  it("needs a signed-in customer (the reset link provides one)", async () => {
    requireCustomerMock.mockResolvedValue({ ok: false, error: "You must be signed in to do this." });
    expect(await updateCustomerPassword("a long enough password")).toEqual({
      error: "Your reset link has expired. Request a new one.",
    });
  });

  it("saves a valid password and goes to the account page", async () => {
    await expect(updateCustomerPassword("a long enough password")).rejects.toThrow("NEXT_REDIRECT:/account");
  });

  it.each([
    ["short", "x".repeat(PASSWORD_MIN_LENGTH - 1)],
    ["over 72 bytes", "x".repeat(73)],
  ])("refuses a password that is %s", async (_case, password) => {
    expect((await updateCustomerPassword(password)).error).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("maps Supabase's reuse error", async () => {
    requireCustomerMock.mockResolvedValue({
      ok: true,
      supabase: {
        auth: { updateUser: vi.fn(() => Promise.resolve({ error: { code: "same_password", message: "same" } })) },
      },
      user: { id: "u1" },
    });
    expect((await updateCustomerPassword("a long enough password")).error).toMatch(/haven't used/i);
  });
});

describe("customerSignOut", () => {
  it("signs out and returns to the login page", async () => {
    await expect(customerSignOut()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(signOutMock).toHaveBeenCalled();
  });
});
