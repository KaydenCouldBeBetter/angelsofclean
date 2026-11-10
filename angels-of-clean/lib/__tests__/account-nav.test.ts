import { describe, expect, it } from "vitest";
import { accountNav, isCurrentNavItem } from "../account-nav";
import fs from "fs";
import path from "path";

describe("account nav", () => {
  it("never links to a page that doesn't exist", () => {
    for (const { href } of accountNav()) {
      const page = path.resolve(__dirname, "..", "..", "app", href.slice(1), "page.tsx");
      expect(fs.existsSync(page), href).toBe(true);
    }
  });

  it("gives a household the three core pages only", () => {
    const labels = accountNav({ type: "residential", role: "owner" }).map((i) => i.label);
    expect(labels).toEqual(["Overview", "Visits", "Billing"]);
  });

  it("gives a business Quotes and Locations, and only its owner Team", () => {
    const owner = accountNav({ type: "commercial", role: "owner" });
    const member = accountNav({ type: "commercial", role: "member" });
    expect(owner.map((i) => i.label)).toEqual(["Overview", "Visits", "Billing", "Quotes", "Locations", "Team"]);
    expect(member.map((i) => i.label)).toEqual(["Overview", "Visits", "Billing", "Quotes", "Locations"]);
  });

  it("never links a business page that doesn't exist", () => {
    for (const { href } of accountNav({ type: "commercial", role: "owner" })) {
      const page = path.resolve(__dirname, "..", "..", "app", href.slice(1), "page.tsx");
      expect(fs.existsSync(page), href).toBe(true);
    }
  });

  it("marks Overview only on /account itself", () => {
    expect(isCurrentNavItem("/account", "/account")).toBe(true);
    expect(isCurrentNavItem("/account/visits", "/account")).toBe(false);
  });

  it("marks a section for its own page and its subpages, not a lookalike", () => {
    expect(isCurrentNavItem("/account/visits", "/account/visits")).toBe(true);
    expect(isCurrentNavItem("/account/visits/abc", "/account/visits")).toBe(true);
    expect(isCurrentNavItem("/account/visits-archive", "/account/visits")).toBe(false);
  });
});
