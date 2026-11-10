import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

type Err = { error: unknown };
const verifyOtp = vi.fn<(p: { type: string; token_hash: string }) => Promise<Err>>();
const exchangeCodeForSession = vi.fn<(code: string) => Promise<Err>>();
const getUser = vi.fn();
const supabase = { auth: { verifyOtp, exchangeCodeForSession, getUser } };
vi.mock("@/lib/supabase/server", () => ({ createClient: () => Promise.resolve(supabase) }));

const completeCustomerSignIn = vi.fn();
vi.mock("@/lib/supabase/customer-session", () => ({
  completeCustomerSignIn: (...args: unknown[]) => completeCustomerSignIn(...args),
}));

import { GET as confirm } from "../confirm/route";
import { GET as recovery } from "../recovery/route";

const TOKEN = "C".repeat(43);
const open = (handler: typeof confirm, path: string, query: string) =>
  handler(new NextRequest(`https://angelsofclean.example${path}${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ error: null });
  exchangeCodeForSession.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { user_metadata: {} } } });
  completeCustomerSignIn.mockResolvedValue({ destination: "/account" });
});

describe("GET /auth/confirm", () => {
  const go = (query: string) => open(confirm, "/auth/confirm", query);

  it.each(["signup", "email"])("verifies a %s token and completes sign-in", async (type) => {
    await expect(go(`?token_hash=abc&type=${type}`)).rejects.toThrow("NEXT_REDIRECT:/account");
    expect(verifyOtp).toHaveBeenCalledWith({ type, token_hash: "abc" });
    expect(completeCustomerSignIn).toHaveBeenCalledWith(supabase, null);
  });

  it("accepts the code from Supabase's default template", async () => {
    await expect(go("?code=xyz")).rejects.toThrow("NEXT_REDIRECT:/account");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("xyz");
  });

  it("joins the business an invite was for, using the token saved at sign-up", async () => {
    getUser.mockResolvedValue({ data: { user: { user_metadata: { invite_token: TOKEN } } } });
    await expect(go("?code=xyz")).rejects.toThrow("NEXT_REDIRECT");
    expect(completeCustomerSignIn).toHaveBeenCalledWith(supabase, TOKEN);
  });

  it("ignores a saved token that isn't the shape we issue", async () => {
    getUser.mockResolvedValue({ data: { user: { user_metadata: { invite_token: "x" } } } });
    await expect(go("?code=xyz")).rejects.toThrow("NEXT_REDIRECT");
    expect(completeCustomerSignIn).toHaveBeenCalledWith(supabase, null);
  });

  it("follows wherever completing sign-in says, such as an invite notice", async () => {
    completeCustomerSignIn.mockResolvedValue({ destination: "/account?invite=wrong_email" });
    await expect(go("?code=xyz")).rejects.toThrow("NEXT_REDIRECT:/account?invite=wrong_email");
  });

  it.each([
    ["an expired token", "?token_hash=abc&type=signup", () => verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } })],
    ["a failed code exchange (another browser)", "?code=xyz", () => exchangeCodeForSession.mockResolvedValue({ error: { code: "bad_code_verifier" } })],
    ["no token at all", "", () => {}],
    ["a recovery token (not for this route)", "?token_hash=abc&type=recovery", () => {}],
  ])("sends %s to the login page with an explanation", async (_case, query, arrange) => {
    arrange();
    await expect(go(query)).rejects.toThrow("NEXT_REDIRECT:/login?notice=confirm-failed");
    expect(completeCustomerSignIn).not.toHaveBeenCalled();
  });

  it("ignores a next parameter: the destination is fixed", async () => {
    await expect(go("?code=xyz&next=https://evil.example")).rejects.toThrow("NEXT_REDIRECT:/account");
    expect(redirectMock).not.toHaveBeenCalledWith(expect.stringContaining("evil"));
  });
});

describe("GET /auth/recovery", () => {
  const go = (query: string) => open(recovery, "/auth/recovery", query);

  it("verifies a recovery token and sends the customer to choose a new password", async () => {
    await expect(go("?token_hash=abc&type=recovery")).rejects.toThrow("NEXT_REDIRECT:/reset-password");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
  });

  it("accepts the code from Supabase's default template", async () => {
    await expect(go("?code=xyz")).rejects.toThrow("NEXT_REDIRECT:/reset-password");
  });

  it.each([
    ["an expired token", "?token_hash=abc&type=recovery", () => verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } })],
    ["a failed exchange", "?code=xyz", () => exchangeCodeForSession.mockResolvedValue({ error: { code: "x" } })],
    ["a signup token (not for this route)", "?token_hash=abc&type=signup", () => {}],
    ["no token", "", () => {}],
  ])("sends %s back to request a new link", async (_case, query, arrange) => {
    arrange();
    await expect(go(query)).rejects.toThrow("NEXT_REDIRECT:/forgot-password?error=link");
  });

  it("never touches customer records", async () => {
    await expect(go("?code=xyz")).rejects.toThrow("NEXT_REDIRECT");
    expect(completeCustomerSignIn).not.toHaveBeenCalled();
  });
});
