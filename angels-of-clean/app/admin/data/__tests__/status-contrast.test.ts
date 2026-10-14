import { describe, it, expect } from "vitest";
import { DASHBOARD_STATUS, EMPLOYEE_STATUS_CONFIG, STATUS_CONFIG } from "../mock";

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The Tailwind palette entries STATUS_CONFIG uses (Tailwind v3/v4 sRGB values).
const TAILWIND: Record<string, string> = {
  "emerald-100": "#d1fae5", "emerald-700": "#047857",
  "orange-100": "#ffedd5", "orange-700": "#c2410c",
  "blue-100": "#dbeafe", "blue-700": "#1d4ed8",
  "zinc-100": "#f4f4f5", "zinc-600": "#52525b",
  "red-100": "#fee2e2", "red-700": "#b91c1c",
};

// "text-[#166534]" / "bg-emerald-100" → "#166534" / "#d1fae5"
function hexOf(className: string): string {
  const arbitrary = className.match(/\[(#[0-9a-fA-F]{6})\]/);
  if (arbitrary) return arbitrary[1];
  const named = TAILWIND[className.replace(/^(text|bg)-/, "")];
  if (!named) throw new Error(`Add ${className} to the TAILWIND map in this test`);
  return named;
}

const AA = 4.5;

describe("status chip and banner contrast (WCAG AA, 4.5:1)", () => {
  it.each(Object.entries(DASHBOARD_STATUS))(
    "dashboard, bookings list, and detail banner: %s",
    (_status, cfg) => {
      expect(contrast(hexOf(cfg.chipText), hexOf(cfg.chipBg))).toBeGreaterThanOrEqual(AA);
      // The booking detail banner draws accentColor text on the same background.
      expect(contrast(cfg.accentColor, hexOf(cfg.chipBg))).toBeGreaterThanOrEqual(AA);
    },
  );

  it.each(Object.entries(EMPLOYEE_STATUS_CONFIG))("employee card: %s", (_status, cfg) => {
    expect(contrast(hexOf(cfg.chipText), hexOf(cfg.chipBg))).toBeGreaterThanOrEqual(AA);
  });

  it.each(Object.entries(STATUS_CONFIG))("calendar card: %s", (_status, cfg) => {
    expect(contrast(hexOf(cfg.chipText), hexOf(cfg.chipBg))).toBeGreaterThanOrEqual(AA);
  });
});
