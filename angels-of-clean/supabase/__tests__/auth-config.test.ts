import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// supabase/config.toml configures the local Auth server. It should behave like
// production where the app's safety depends on it, so local testing catches
// what production would do.
const CONFIG = readFileSync(join(__dirname, "..", "config.toml"), "utf8");

/** The `key = value` lines of one [section] (not its sub-sections). */
function section(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inside = false;
  for (const raw of CONFIG.split("\n")) {
    const line = raw.trim();
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      inside = header[1] === name;
      continue;
    }
    const pair = inside ? line.match(/^([a-z_]+)\s*=\s*(.+)$/) : null;
    if (pair) out[pair[1]] = pair[2];
  }
  return out;
}

describe("supabase/config.toml auth settings", () => {
  it("requires email confirmation, because claiming bookings trusts a confirmed email", () => {
    // claim_account_records() and accept_account_invite() treat
    // auth.users.email_confirmed_at as proof the user owns the address. With
    // confirmations off, Auth sets it at sign-up, so anyone could sign up with a
    // customer's email and read their bookings.
    expect(section("auth.email").enable_confirmations).toBe("true");
  });
});
