import { describe, expect, it } from "vitest";
import { CUSTOMER_STATUS, PLAN_STATUS_CHIP, PLAN_STATUS_LABEL } from "../customer-status";
import { DASHBOARD_STATUS } from "@/app/admin/status-config";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const hex = (className: string) => className.match(/\[(#[0-9a-fA-F]{6})\]/)![1];

describe("customer status wording", () => {
  it("never calls an unconfirmed request booked or confirmed", () => {
    const { label, description } = CUSTOMER_STATUS.pending;
    expect(`${label} ${description}`).not.toMatch(/\b(booked|confirmed)\b/i);
    expect(label).toBe("Awaiting confirmation");
  });

  it("gives every status a distinct label, in plain words, not the office's", () => {
    const labels = Object.values(CUSTOMER_STATUS).map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).not.toContain("Pending");
    expect(labels).not.toContain("Active");
  });

  it("promises no price and no online payment (B28)", () => {
    for (const { description } of Object.values(CUSTOMER_STATUS)) {
      expect(description).not.toMatch(/\$|charge|pay/i);
    }
  });
});

describe("customer status colours (WCAG AA, 4.5:1)", () => {
  it.each(Object.entries(CUSTOMER_STATUS))("%s chip", (_status, cfg) => {
    expect(contrast(hex(cfg.chipText), hex(cfg.chipBg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(PLAN_STATUS_CHIP))("plan %s chip", (_status, cfg) => {
    expect(contrast(hex(cfg.chipText), hex(cfg.chipBg))).toBeGreaterThanOrEqual(4.5);
  });

  it("uses the same colour pairs as the admin chips, which are tested on their own", () => {
    for (const status of Object.keys(CUSTOMER_STATUS) as (keyof typeof CUSTOMER_STATUS)[]) {
      expect(CUSTOMER_STATUS[status].chipBg).toBe(DASHBOARD_STATUS[status].chipBg);
      expect(CUSTOMER_STATUS[status].chipText).toBe(DASHBOARD_STATUS[status].chipText);
    }
  });
});

describe("plan status labels", () => {
  it("has a label for each status", () => {
    expect(PLAN_STATUS_LABEL).toEqual({ active: "Active", paused: "Paused", ended: "Ended" });
  });
});
