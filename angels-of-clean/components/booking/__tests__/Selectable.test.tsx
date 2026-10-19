import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import Selectable, { SelectableGroup } from "../Selectable";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderGroup(type: "radio" | "checkbox", selected: string[], onSelect = vi.fn()) {
  act(() =>
    root.render(
      <SelectableGroup type={type} aria-label="Pick">
        {["a", "b", "c"].map((v) => (
          <Selectable key={v} value={v} selected={selected.includes(v)} onSelect={() => onSelect(v)}>
            Option {v}
          </Selectable>
        ))}
      </SelectableGroup>,
    ),
  );
  return onSelect;
}

const inputs = () => [...container.querySelectorAll("input")];

describe("Selectable", () => {
  it("is a native radio inside a labelled radiogroup, so screen readers announce checked", () => {
    renderGroup("radio", ["b"]);

    expect(container.querySelector('[role="radiogroup"]')?.getAttribute("aria-label")).toBe("Pick");
    expect(inputs().map((i) => [i.type, i.checked])).toEqual([
      ["radio", false],
      ["radio", true],
      ["radio", false],
    ]);
    // The input sits inside its label, so "Option b" is its accessible name.
    expect(inputs()[1].closest("label")?.textContent).toContain("Option b");
  });

  it("uses checkboxes in a group for pick-many choices", () => {
    renderGroup("checkbox", ["a", "c"]);

    expect(container.querySelector('[role="group"]')).not.toBeNull();
    expect(inputs().map((i) => [i.type, i.checked])).toEqual([
      ["checkbox", true],
      ["checkbox", false],
      ["checkbox", true],
    ]);
  });

  it("shows the selected state without relying on colour: a check mark, hidden from screen readers", () => {
    renderGroup("radio", ["b"]);

    const labels = [...container.querySelectorAll("label")];
    const checks = labels.map((l) => l.querySelector('svg[aria-hidden="true"]') !== null);
    expect(checks).toEqual([false, true, false]);
  });

  it("gives the selected choice the solid brand fill with white text", () => {
    renderGroup("radio", ["b"]);

    const [a, b] = [...container.querySelectorAll("label")];
    expect(b.className).toContain("bg-primary");
    expect(b.className).toContain("text-white");
    // The value matters: Tailwind's group-data-selected: matches data-selected="true".
    expect(b.getAttribute("data-selected")).toBe("true");
    expect(a.className).not.toContain("bg-primary");
    expect(a.hasAttribute("data-selected")).toBe(false);
  });

  it("calls onSelect with the clicked choice", () => {
    const onSelect = renderGroup("radio", ["a"]);

    act(() => inputs()[2].click());

    expect(onSelect).toHaveBeenCalledWith("c");
  });

  it("gives each rendered group its own input name, so two copies on one page stay independent", () => {
    act(() =>
      root.render(
        <>
          <SelectableGroup type="radio" aria-label="First">
            <Selectable value="x" selected onSelect={() => {}}>X</Selectable>
          </SelectableGroup>
          <SelectableGroup type="radio" aria-label="Second">
            <Selectable value="x" selected onSelect={() => {}}>X</Selectable>
          </SelectableGroup>
        </>,
      ),
    );

    const [first, second] = inputs();
    expect(first.name).not.toBe("");
    expect(first.name).not.toBe(second.name);
    expect(first.checked && second.checked).toBe(true);
  });

  it("does not show a disabled choice as selected, and disables its input", () => {
    act(() =>
      root.render(
        <SelectableGroup type="radio" aria-label="Pick">
          <Selectable value="x" selected disabled onSelect={() => {}}>X</Selectable>
        </SelectableGroup>,
      ),
    );

    expect(inputs()[0].disabled).toBe(true);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("lets a choice carry its own accessible name", () => {
    act(() =>
      root.render(
        <SelectableGroup type="radio" aria-label="Pick">
          <Selectable value="x" selected={false} aria-label="Mon the 12" onSelect={() => {}}>
            <span>Mon</span>
            <span>12</span>
          </Selectable>
        </SelectableGroup>,
      ),
    );

    expect(inputs()[0].getAttribute("aria-label")).toBe("Mon the 12");
  });
});
