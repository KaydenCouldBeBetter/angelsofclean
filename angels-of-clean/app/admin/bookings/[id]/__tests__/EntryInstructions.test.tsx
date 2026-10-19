import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EntryInstructions from "../EntryInstructions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ updateEntryInstructions: vi.fn() }));

function render(props: Parameters<typeof EntryInstructions>[0]) {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(<EntryInstructions {...props} />),
    "text/html",
  );
}

function buttonLabels(doc: Document) {
  return [...doc.querySelectorAll("button")].map((b) => b.textContent);
}

describe("EntryInstructions", () => {
  it("shows the stored instructions with an Edit button", () => {
    const doc = render({ bookingId: "b-1", instructions: "Side gate code 4412" });

    expect(doc.body.textContent).toContain("Side gate code 4412");
    expect(buttonLabels(doc)).toEqual(["Edit entry instructions"]);
  });

  it("offers Add when none were given", () => {
    const doc = render({ bookingId: "b-1", instructions: null });

    expect(doc.body.textContent).toContain("None given.");
    expect(buttonLabels(doc)).toEqual(["Add entry instructions"]);
  });

  it("says the lookup failed, and offers no edit that could overwrite unread instructions", () => {
    const doc = render({ bookingId: "b-1", instructions: null, loadFailed: true });

    expect(doc.body.textContent).toContain("Entry instructions couldn't be loaded.");
    expect(doc.body.textContent).not.toContain("None given.");
    expect(doc.querySelectorAll("button")).toHaveLength(0);
  });
});
