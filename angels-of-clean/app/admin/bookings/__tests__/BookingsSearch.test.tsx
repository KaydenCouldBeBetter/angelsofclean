import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BookingsSearch from "../BookingsSearch";

// Pass #2 finding 21: a Lucide icon, hidden from screen readers, instead of an
// emoji inside the placeholder.
describe("BookingsSearch", () => {
  const html = renderToStaticMarkup(<BookingsSearch value="" onChange={() => {}} />);
  const doc = new DOMParser().parseFromString(html, "text/html");

  it("draws the search icon as an aria-hidden SVG", () => {
    const icon = doc.querySelector("svg")!;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.classList.contains("lucide-search")).toBe(true);
  });

  it("has a plain-text placeholder with no emoji", () => {
    const placeholder = doc.querySelector("input")!.getAttribute("placeholder")!;
    expect(placeholder).toBe("Search...");
    expect(placeholder).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
