import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SettingsPage from "../page";

// Notifications aren't built yet, so the page must not look like it saves.
describe("SettingsPage", () => {
  const html = renderToStaticMarkup(<SettingsPage />);
  const doc = new DOMParser().parseFromString(html, "text/html");

  it("labels notifications as coming soon and explains why", () => {
    const fieldset = doc.querySelector("fieldset")!;
    expect(fieldset.querySelector("legend")?.textContent).toContain("Coming soon");
    const status = doc.getElementById(fieldset.getAttribute("aria-describedby")!);
    expect(status?.textContent).toContain("aren't available yet");
  });

  it("disables every toggle and offers no save button", () => {
    const fieldset = doc.querySelector("fieldset")!;
    expect(fieldset.disabled).toBe(true);
    const toggles = fieldset.querySelectorAll("input[type=checkbox]");
    expect(toggles).toHaveLength(2);
    toggles.forEach((t) => expect((t as HTMLInputElement).checked).toBe(false));
    expect(doc.querySelector("button")).toBeNull();
  });
});
