import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "../csp";

const SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";

// Parses "a x y; b z" into { a: ["x", "y"], b: ["z"] }.
function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split("; ").map((d) => {
      const [name, ...sources] = d.split(" ");
      return [name, sources];
    }),
  );
}

describe("buildCsp", () => {
  it("public policy: inline scripts allowed (prerendered pages), no eval in production", () => {
    const d = directives(buildCsp({ isDev: false, supabaseUrl: SUPABASE_URL }));
    expect(d["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it("admin policy: only scripts carrying the nonce, no inline allowance", () => {
    const d = directives(buildCsp({ nonce: "abc123", isDev: false, supabaseUrl: SUPABASE_URL }));
    expect(d["script-src"]).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
  });

  it("allows eval only in development, for React Refresh", () => {
    for (const nonce of [undefined, "abc123"]) {
      expect(buildCsp({ nonce, isDev: true, supabaseUrl: SUPABASE_URL })).toContain("'unsafe-eval'");
      expect(buildCsp({ nonce, isDev: false, supabaseUrl: SUPABASE_URL })).not.toContain(
        "'unsafe-eval'",
      );
    }
  });

  it("lets the browser reach the Supabase project and nothing else off-site", () => {
    const d = directives(buildCsp({ isDev: false, supabaseUrl: `${SUPABASE_URL}/` }));
    expect(d["connect-src"]).toEqual([
      "'self'",
      "https://abcdefghijklmnop.supabase.co",
      "wss://abcdefghijklmnop.supabase.co",
    ]);
  });

  it("falls back to same-origin connections when the Supabase URL is missing or invalid", () => {
    for (const supabaseUrl of [undefined, "", "not a url"]) {
      expect(directives(buildCsp({ isDev: false, supabaseUrl }))["connect-src"]).toEqual([
        "'self'",
      ]);
    }
  });

  it("blocks plugins, base-tag hijacking, off-site form posts, and framing", () => {
    const d = directives(buildCsp({ isDev: false, supabaseUrl: SUPABASE_URL }));
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["form-action"]).toEqual(["'self'"]);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["font-src"]).toEqual(["'self'"]);
  });
});

describe("createNonce", () => {
  it("returns 128 bits of base64, different every call", () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });
});
