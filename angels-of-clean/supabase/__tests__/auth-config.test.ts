import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// supabase/config.toml configures the local Auth server. It should behave like
// production where the app's safety depends on it, so local testing catches
// what production would do.
const CONFIG = readFileSync(join(__dirname, "..", "config.toml"), "utf8");

/**
 * The `key = value` pairs of one [section] (not its sub-sections). Enough TOML
 * for this file: strings, booleans and arrays, which may span several lines.
 */
function section(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inside = false;
  let openKey: string | null = null;
  for (const raw of CONFIG.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (openKey) {
      out[openKey] += line;
      if (line.startsWith("]")) openKey = null;
      continue;
    }
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      inside = header[1] === name;
      continue;
    }
    const pair = inside ? line.match(/^([a-z_]+)\s*=\s*(.+)$/) : null;
    if (!pair) continue;
    out[pair[1]] = pair[2];
    if (pair[2] === "[") openKey = pair[1];
  }
  // TOML allows a trailing comma in arrays; JSON doesn't.
  for (const key of Object.keys(out)) out[key] = out[key].replace(/,\]$/, "]");
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

  it("allows the app's email-link routes on localhost, where npm run dev serves", () => {
    // Auth accepts any redirect on site_url's host (127.0.0.1) but ignores one on
    // another host that isn't listed, sending the user to site_url (the
    // homepage), which can't finish a sign-up or password reset.
    const auth = section("auth");
    expect(new URL(JSON.parse(auth.site_url) as string).hostname).toBe("127.0.0.1");
    const allowed = JSON.parse(auth.additional_redirect_urls) as string[];
    for (const path of ["/auth/confirm", "/auth/recovery", "/admin/reset-password/confirm"]) {
      expect(allowed).toContain(`http://localhost:3000${path}`);
    }
  });
});
