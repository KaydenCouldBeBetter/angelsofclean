// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// The signed-out client has exactly a visitor's privileges. This pins that it is
// built from the anon key, never the service-role key, and keeps no session.
vi.mock("server-only", () => ({}));
const createSupabaseClient = vi.fn(() => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: (...a: unknown[]) => createSupabaseClient(...(a as [])) }));

import { createPublicClient } from "../public";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

describe("createPublicClient", () => {
  it("uses the anon key and keeps no session", () => {
    createPublicClient();
    expect(createSupabaseClient).toHaveBeenCalledWith("https://example.supabase.co", "anon-key", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("never touches the service-role key", () => {
    createPublicClient();
    expect(JSON.stringify(createSupabaseClient.mock.calls)).not.toContain("service-role-key");
  });
});
