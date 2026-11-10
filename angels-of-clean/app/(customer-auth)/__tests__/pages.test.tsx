import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

const getSessionRole = vi.fn();
vi.mock("@/lib/supabase/session-role", () => ({ getSessionRole: () => getSessionRole() }));

// The forms are covered in forms.test.tsx; here only what the pages hand them.
vi.mock("../login/LoginForm", () => ({ default: () => null }));
vi.mock("../signup/SignupForm", () => ({ default: () => null }));
vi.mock("../reset-password/ResetPasswordForm", () => ({ default: () => null }));

import LoginPage from "../login/page";
import SignupPage from "../signup/page";
import ResetPasswordPage from "../reset-password/page";

const TOKEN = "E".repeat(43);
const params = <T,>(value: T) => Promise.resolve(value);

beforeEach(() => {
  vi.clearAllMocks();
  getSessionRole.mockResolvedValue(null);
});

describe("login page", () => {
  it("shows the form to a visitor who isn't signed in", async () => {
    const element = (await LoginPage({ searchParams: params({}) })) as ReactElement<{
      inviteToken: string | null;
      notice: string | null;
    }>;
    expect(element.props).toMatchObject({ inviteToken: null, notice: null });
  });

  it("sends a signed-in customer on, and a signed-in admin to their own portal", async () => {
    getSessionRole.mockResolvedValue("customer");
    await expect(LoginPage({ searchParams: params({}) })).rejects.toThrow("NEXT_REDIRECT:/account");
    getSessionRole.mockResolvedValue("admin");
    await expect(LoginPage({ searchParams: params({}) })).rejects.toThrow("NEXT_REDIRECT:/admin/dashboard");
  });

  it("only follows an invite on a deliberate sign-in, so a signed-in visitor still sees the form", async () => {
    getSessionRole.mockResolvedValue("customer");
    const element = (await LoginPage({ searchParams: params({ invite: TOKEN }) })) as ReactElement<{
      inviteToken: string | null;
    }>;
    expect(element.props.inviteToken).toBe(TOKEN);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("drops an invite that isn't the shape we issue", async () => {
    const element = (await LoginPage({ searchParams: params({ invite: "<script>" }) })) as ReactElement<{
      inviteToken: string | null;
    }>;
    expect(element.props.inviteToken).toBeNull();
  });

  it("words only the notices it knows; the address bar can't write copy", async () => {
    const known = (await LoginPage({
      searchParams: params({ notice: "confirm-failed" }),
    })) as ReactElement<{ notice: string | null }>;
    expect(known.props.notice).toMatch(/couldn't sign you in from that link/);

    const unknown = (await LoginPage({
      searchParams: params({ notice: "Your account is suspended, call 555-0100" }),
    })) as ReactElement<{ notice: string | null }>;
    expect(unknown.props.notice).toBeNull();
  });
});

describe("signup page", () => {
  it("shows the form to a visitor, with a valid invite token", async () => {
    const element = (await SignupPage({ searchParams: params({ invite: TOKEN }) })) as ReactElement<{
      inviteToken: string | null;
    }>;
    expect(element.props.inviteToken).toBe(TOKEN);
  });

  it("sends a signed-in customer to their account", async () => {
    getSessionRole.mockResolvedValue("customer");
    await expect(SignupPage({ searchParams: params({}) })).rejects.toThrow("NEXT_REDIRECT:/account");
  });
});

describe("reset password page", () => {
  it("needs the session the reset link provides", async () => {
    await expect(ResetPasswordPage()).rejects.toThrow("NEXT_REDIRECT:/forgot-password?error=link");
  });

  it("shows the form to a signed-in visitor", async () => {
    getSessionRole.mockResolvedValue("customer");
    await expect(ResetPasswordPage()).resolves.toBeDefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
