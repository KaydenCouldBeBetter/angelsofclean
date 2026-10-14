import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

let currentUser: { app_metadata: Record<string, unknown> } | null = null;
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: () =>
    Promise.resolve({ supabaseResponse: NextResponse.next(), user: currentUser }),
}));

import { middleware } from "../middleware";

async function visit(path: string) {
  const res = await middleware(new NextRequest(`https://angelsofclean.example${path}`));
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : "allowed";
}

beforeEach(() => {
  currentUser = null;
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
