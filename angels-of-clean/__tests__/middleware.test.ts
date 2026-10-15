import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

let currentUser: { app_metadata: Record<string, unknown> } | null = null;
// The request as updateSession saw it, i.e. the headers the page renders with.
let forwardedRequest: NextRequest | null = null;
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (request: NextRequest) => {
    forwardedRequest = request;
    return Promise.resolve({ supabaseResponse: NextResponse.next(), user: currentUser });
  },
}));

import { middleware } from "../middleware";

async function visit(path: string) {
  const res = await middleware(new NextRequest(`https://angelsofclean.example${path}`));
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : "allowed";
}

beforeEach(() => {
  currentUser = null;
  forwardedRequest = null;
});

describe("admin middleware", () => {
  it.each(["/admin", "/admin/forgot-password", "/admin/reset-password/confirm"])(
    "lets a signed-out visitor reach %s",
    async (path) => {
      expect(await visit(path)).toBe("allowed");
    },
  );

  it.each(["/admin/dashboard", "/admin/quotes", "/admin/reset-password"])(
    "sends a signed-out visitor from %s to sign in",
    async (path) => {
      expect(await visit(path)).toBe("/admin");
    },
  );

  it("sends a signed-in non-admin to sign in", async () => {
    currentUser = { app_metadata: {} };
    expect(await visit("/admin/reset-password")).toBe("/admin");
  });

  it("lets an admin (including one signed in by a reset link) set a new password", async () => {
    currentUser = { app_metadata: { role: "admin" } };
    expect(await visit("/admin/reset-password")).toBe("allowed");
    expect(await visit("/admin/dashboard")).toBe("allowed");
  });

  it("matches public routes exactly, not by prefix", async () => {
    expect(await visit("/admin/forgot-password-but-not-really")).toBe("/admin");
  });
});

describe("admin Content-Security-Policy", () => {
  const nonceOf = (csp: string | null) => csp?.match(/'nonce-([^']+)'/)?.[1];

  it("sends the page a nonce policy and puts the same policy on the response", async () => {
    currentUser = { app_metadata: { role: "admin" } };
    const res = await middleware(new NextRequest("https://angelsofclean.example/admin/dashboard"));

    const sent = res.headers.get("content-security-policy");
    expect(nonceOf(sent)).toBeTruthy();
    expect(sent).toMatch(/script-src [^;]*'strict-dynamic'/);
    expect(sent).not.toMatch(/script-src [^;]*'unsafe-inline'/);
    // Next.js reads the nonce from the request header while rendering.
    expect(forwardedRequest?.headers.get("content-security-policy")).toBe(sent);
  });

  it("uses a fresh nonce for every request", async () => {
    const first = await middleware(new NextRequest("https://angelsofclean.example/admin"));
    const second = await middleware(new NextRequest("https://angelsofclean.example/admin"));
    expect(nonceOf(first.headers.get("content-security-policy"))).not.toBe(
      nonceOf(second.headers.get("content-security-policy")),
    );
  });
});
