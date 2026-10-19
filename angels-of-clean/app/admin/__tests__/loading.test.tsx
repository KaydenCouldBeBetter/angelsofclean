import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminLoading from "../loading";

describe("admin loading skeleton", () => {
  const html = renderToStaticMarkup(<AdminLoading />);

  it("tells assistive tech the page is loading and hides the placeholder shapes", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('class="sr-only">Loading');
    expect(html).toContain('aria-hidden="true"');
  });

  it("stops pulsing for people who ask for reduced motion", () => {
    expect(html).toContain("animate-pulse");
    expect(html).toContain("motion-reduce:animate-none");
  });
});
