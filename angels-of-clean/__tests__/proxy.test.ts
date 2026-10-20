// @vitest-environment node
// Next.js 16 runs proxy.ts in the Node.js runtime (it can't be configured),
// so test it there rather than in jsdom.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { SessionCheck } from "@/lib/supabase/middleware";

let currentSession: SessionCheck = { state: "signed-out" };
// Cookies the session refresh set, which must survive a redirect.
let refreshedCookies: { name: string; value: string }[] = [];
// The request as updateSession saw it, i.e. the headers the page renders with.
let forwardedRequest: NextRequest | null = null;
const updateSession = vi.fn((request: NextRequest) => {
  forwardedRequest = request;
  const supabaseResponse = NextResponse.next();
  refreshedCookies.forEach((c) => supabaseResponse.cookies.set(c.name, c.value));
  return Promise.resolve({ supabaseResponse, session: currentSession });
});
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (request: NextRequest) => updateSession(request),
}));

import { config, proxy } from "../proxy";

const signedIn = (role: unknown): SessionCheck => ({ state: "signed-in", role });

async function visit(path: string) {
  const res = await proxy(new NextRequest(`https://angelsofclean.example${path}`));
  const location = res.headers.get("location");
  if (!location) return "allowed";
  const url = new URL(location);
  return url.pathname + url.search;
}

beforeEach(() => {
  currentSession = { state: "signed-out" };
  refreshedCookies = [];
  forwardedRequest = null;
  updateSession.mockClear();
});

describe("admin proxy", () => {
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

  it.each([undefined, "editor", "Admin", ["admin"]])(
    "sends a signed-in non-admin (role %j) to sign in from every admin page",
    async (role) => {
      currentSession = signedIn(role);
      for (const path of ["/admin/dashboard", "/admin/bookings/abc", "/admin/reset-password"]) {
        expect(await visit(path)).toBe("/admin");
      }
    },
  );

  it("shows a signed-in non-admin the sign-in form instead of looping", async () => {
    currentSession = signedIn(undefined);
    expect(await visit("/admin")).toBe("allowed");
  });

  it("lets an admin (including one signed in by a reset link) set a new password", async () => {
    currentSession = signedIn("admin");
    expect(await visit("/admin/reset-password")).toBe("allowed");
    expect(await visit("/admin/dashboard")).toBe("allowed");
    expect(await visit("/admin/bookings/abc")).toBe("allowed");
  });

  it("sends an admin who opens sign-in on to the dashboard", async () => {
    currentSession = signedIn("admin");
    expect(await visit("/admin")).toBe("/admin/dashboard");
  });

  it("keeps refreshed session cookies on a redirect", async () => {
    currentSession = signedIn("admin");
    refreshedCookies = [{ name: "sb-projref-auth-token", value: "fresh" }];
    const res = await proxy(new NextRequest("https://angelsofclean.example/admin"));
    expect(res.cookies.get("sb-projref-auth-token")?.value).toBe("fresh");
  });

  it("matches public routes exactly, not by prefix", async () => {
    expect(await visit("/admin/forgot-password-but-not-really")).toBe("/admin");
  });
});

describe("admin proxy when Auth doesn't answer in time", () => {
  beforeEach(() => {
    currentSession = { state: "unavailable" };
  });

  it("keeps protected pages closed and shows the retry screen, remembering the page", async () => {
    const location = await visit("/admin/bookings?filter=past");
    const url = new URL(location, "https://angelsofclean.example");
    expect(url.pathname).toBe("/admin");
    expect(url.searchParams.get("auth")).toBe("retry");
    expect(url.searchParams.get("next")).toBe("/admin/bookings?filter=past");
  });

  it("shows the retry screen instead of the sign-in form on /admin", async () => {
    expect(await visit("/admin")).toBe("/admin?auth=retry&next=%2Fadmin");
  });

  it.each(["/admin/forgot-password", "/admin/reset-password/confirm"])(
    "still lets the visitor reach %s, which needs no session",
    async (path) => {
      expect(await visit(path)).toBe("allowed");
    },
  );

  it("serves the retry screen without waiting on Auth again", async () => {
    const res = await proxy(
      new NextRequest("https://angelsofclean.example/admin?auth=retry&next=/admin/dashboard"),
    );
    expect(res.headers.get("location")).toBeNull();
    expect(updateSession).not.toHaveBeenCalled();
    expect(res.headers.get("content-security-policy")).toMatch(/'nonce-/);
  });

  it("checks Auth as usual on a protected page that merely carries auth=retry", async () => {
    expect(await visit("/admin/dashboard?auth=retry")).toMatch(/^\/admin\?auth=retry/);
    expect(updateSession).toHaveBeenCalledTimes(1);
  });
});

describe("admin Content-Security-Policy", () => {
  const nonceOf = (csp: string | null) => csp?.match(/'nonce-([^']+)'/)?.[1];

  it("sends the page a nonce policy and puts the same policy on the response", async () => {
    currentSession = signedIn("admin");
    const res = await proxy(new NextRequest("https://angelsofclean.example/admin/dashboard"));

    const sent = res.headers.get("content-security-policy");
    expect(nonceOf(sent)).toBeTruthy();
    expect(sent).toMatch(/script-src [^;]*'strict-dynamic'/);
    expect(sent).not.toMatch(/script-src [^;]*'unsafe-inline'/);
    // Next.js reads the nonce from the request header while rendering.
    expect(forwardedRequest?.headers.get("content-security-policy")).toBe(sent);
  });

  it("uses a fresh nonce for every request", async () => {
    const first = await proxy(new NextRequest("https://angelsofclean.example/admin"));
    const second = await proxy(new NextRequest("https://angelsofclean.example/admin"));
    expect(nonceOf(first.headers.get("content-security-policy"))).not.toBe(
      nonceOf(second.headers.get("content-security-policy")),
    );
  });
});

describe("proxy file convention", () => {
  const appRoot = path.resolve(__dirname, "..");

  it("lives in proxy.ts, with no deprecated middleware.ts beside it", () => {
    expect(existsSync(path.join(appRoot, "proxy.ts"))).toBe(true);
    expect(existsSync(path.join(appRoot, "middleware.ts"))).toBe(false);
  });

  it("guards every admin page and nothing else", () => {
    expect(config).toEqual({ matcher: ["/admin/:path*"] });
  });
});
