import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const verifyOtpMock = vi.fn<(params: { type: string; token_hash: string }) => Promise<{ error: unknown }>>(
  () => Promise.resolve({ error: null }),
);
const exchangeCodeForSessionMock = vi.fn<(code: string) => Promise<{ error: unknown }>>(() =>
  Promise.resolve({ error: null }),
);
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { verifyOtp: verifyOtpMock, exchangeCodeForSession: exchangeCodeForSessionMock },
    }),
}));

import { GET } from "../route";

function open(query: string) {
  return GET(new NextRequest(`https://angelsofclean.example/admin/reset-password/confirm${query}`));
}

const TO_RESET = "NEXT_REDIRECT:/admin/reset-password";
const TO_FAILED = "NEXT_REDIRECT:/admin/forgot-password?error=link";

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtpMock.mockResolvedValue({ error: null });
  exchangeCodeForSessionMock.mockResolvedValue({ error: null });
});

describe("GET /admin/reset-password/confirm", () => {
  it("verifies a recovery token and sends the admin to choose a new password", async () => {
    await expect(open("?token_hash=abc123&type=recovery")).rejects.toThrow(TO_RESET);
    expect(verifyOtpMock).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc123" });
  });

  it("accepts the code from Supabase's default email template", async () => {
    await expect(open("?code=xyz")).rejects.toThrow(TO_RESET);
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("xyz");
  });

  it("sends an expired or reused token back to request a new link", async () => {
    verifyOtpMock.mockResolvedValue({ error: { code: "otp_expired" } });

    await expect(open("?token_hash=abc123&type=recovery")).rejects.toThrow(TO_FAILED);
  });

  it("sends a failed code exchange back to request a new link", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: { code: "bad_code_verifier" } });

    await expect(open("?code=xyz")).rejects.toThrow(TO_FAILED);
  });

  it("only accepts recovery tokens, not other kinds of email link", async () => {
    await expect(open("?token_hash=abc123&type=signup")).rejects.toThrow(TO_FAILED);
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it("rejects a link with nothing to verify", async () => {
    await expect(open("")).rejects.toThrow(TO_FAILED);
  });

  it("ignores a `next` parameter, so the link can't redirect to another site", async () => {
    await expect(
      open("?token_hash=abc123&type=recovery&next=https://evil.example"),
    ).rejects.toThrow(TO_RESET);
  });
});
