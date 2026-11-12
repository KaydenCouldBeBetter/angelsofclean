import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

// Headers added in the submission check (findings H1, L11), on top of the ones
// __tests__/next-config.test.ts already pins.
describe("next.config.ts hardening", async () => {
  const rules = await nextConfig.headers!();
  const everywhere = rules.find((rule) => rule.source === "/(.*)")!;
  const header = (key: string) => everywhere.headers.find((h) => h.key === key)?.value;

  it("tells browsers to use HTTPS only, for at least a year (H1)", () => {
    const hsts = header("Strict-Transport-Security");
    expect(hsts).toBeDefined();
    const maxAge = Number(hsts!.match(/max-age=(\d+)/)?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toContain("includeSubDomains");
  });
});
