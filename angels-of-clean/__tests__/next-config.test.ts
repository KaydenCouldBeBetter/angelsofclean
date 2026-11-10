// @vitest-environment node
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

// proxy.ts gives /admin and /account pages a per-request nonce policy, so the
// static policy from next.config.ts must cover every other route and neither of
// those (two Content-Security-Policy headers would be intersected by the browser).
describe("next.config.ts security headers", async () => {
  const rules = await nextConfig.headers!();
  const csp = rules.find((rule) => rule.headers.some((h) => h.key === "Content-Security-Policy"))!;

  // "/:path((?!…).*)" -> the regular expression inside the parameter.
  const pattern = new RegExp(`^/${csp.source.match(/^\/:path\((.*)\)$/)![1]}$`);
  const covered = (path: string) => pattern.test(path);

  it.each(["/", "/residential", "/residential/review", "/login", "/signup", "/auth/confirm", "/accounts", "/administration"])(
    "puts the static policy on %s",
    (path) => expect(covered(path)).toBe(true),
  );

  it.each(["/admin", "/admin/dashboard", "/account", "/account/billing", "/account/visits/abc"])(
    "leaves %s to the nonce policy from proxy.ts",
    (path) => expect(covered(path)).toBe(false),
  );

  it("sets the other security headers everywhere", () => {
    const all = rules.find((rule) => rule.source === "/(.*)")!;
    expect(all.headers.map((h) => h.key)).toEqual(
      expect.arrayContaining(["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]),
    );
  });
});
