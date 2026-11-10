import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReviewCard, { initialsOf } from "../ReviewCard";
import ReviewGrid from "../ReviewGrid";
import type { ReviewContent } from "@/lib/homepage-content";

const base: ReviewContent = {
  id: "test",
  quote: "Fabulous cleaning team. Did a super job!",
  author: "Audrey G.",
  placeholder: false,
  onHomepage: true,
};

function render(review: Partial<ReviewContent> = {}) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<ReviewCard review={{ ...base, ...review }} />);
  return container;
}

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Heather W.")).toBe("HW");
    expect(initialsOf("Cathy D.")).toBe("CD");
  });

  it("handles one name, extra words and stray punctuation", () => {
    expect(initialsOf("Madonna")).toBe("M");
    expect(initialsOf("Mary Jo Smith")).toBe("MJ");
    expect(initialsOf("  “Audrey”  G. ")).toBe("AG");
  });

  it("is empty for an empty name", () => {
    expect(initialsOf("")).toBe("");
  });
});

describe("ReviewCard", () => {
  it("keeps the semantic figure, blockquote and figcaption, with the author's name alone in the caption", () => {
    const card = render();
    expect(card.querySelector("figure blockquote p")?.textContent).toBe(base.quote);
    expect(card.querySelector("figure > figcaption")?.textContent).toBe("Audrey G.");
  });

  it("hides every icon and the initials avatar from assistive technology", () => {
    const card = render({ highlight: "Fabulous cleaning team." });
    const svgs = [...card.querySelectorAll("svg")];
    expect(svgs.length).toBeGreaterThanOrEqual(2); // quote mark and sparkle
    for (const svg of svgs) expect(svg.getAttribute("aria-hidden")).toBe("true");
    const avatar = [...card.querySelectorAll("span")].find((s) => s.textContent === "AG");
    expect(avatar?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows no star rating, since none is known for these reviews", () => {
    const card = render();
    expect(card.textContent).not.toMatch(/★|stars?\b|out of 5/i);
  });

  it("bolds the highlight without changing the quote's text", () => {
    const card = render({ highlight: "Did a super job!" });
    expect(card.querySelector("blockquote span")?.textContent).toBe("Did a super job!");
    expect(card.querySelector("blockquote")?.textContent).toBe(base.quote);
  });

  it("shows the quote plain when the highlight isn't in it", () => {
    const card = render({ highlight: "not in the quote" });
    expect(card.querySelector("blockquote span")).toBeNull();
    expect(card.querySelector("blockquote")?.textContent).toBe(base.quote);
  });

  it("makes a featured review a solid teal card and others white", () => {
    expect(render({ featured: true }).querySelector("figure")?.className).toContain("bg-primary");
    expect(render({ featured: true }).querySelector("figure")?.className).toContain("text-white");
    expect(render().querySelector("figure")?.className).toContain("bg-white");
  });

  it("only moves on hover when the visitor hasn't asked for reduced motion", () => {
    const classes = (render().querySelector("figure")?.className ?? "").split(/\s+/);
    const moving = classes.filter((c) => /(^|:)(-?translate|transition)/.test(c) || c.includes("hover:-translate"));
    expect(moving.length).toBeGreaterThan(0);
    for (const c of moving) expect(c.startsWith("motion-safe:"), c).toBe(true);
  });

  it("shows the Placeholder label in place of the sparkle for a placeholder review", () => {
    const card = render({ placeholder: true });
    expect([...card.querySelectorAll("span")].filter((s) => s.textContent === "Placeholder")).toHaveLength(1);
  });
});

describe("ReviewGrid", () => {
  it("renders one card per review in a labelled list", () => {
    const grid = document.createElement("div");
    grid.innerHTML = renderToStaticMarkup(
      <ReviewGrid reviews={[base, { ...base, id: "two", author: "Cathy D." }]} columns={3} />,
    );
    expect(grid.querySelector('ul[aria-label="Customer reviews"]')).not.toBeNull();
    expect(grid.querySelectorAll("li figure")).toHaveLength(2);
  });
});
