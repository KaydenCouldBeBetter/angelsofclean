import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
type Result = { success: boolean; error?: string };
const updateHomeSize = vi.fn<(...a: unknown[]) => Promise<Result>>();
vi.mock("../actions", () => ({ updateHomeSize: (...a: unknown[]) => updateHomeSize(...a) }));

import HomeSizeCard from "../HomeSizeCard";
import type { HomeSize } from "@/lib/home-size";

const ID = "11111111-1111-4111-8111-111111111111";
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  updateHomeSize.mockResolvedValue({ success: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (homeSize: HomeSize | null, editable = true) =>
  act(() => root.render(<HomeSizeCard bookingId={ID} homeSize={homeSize} editable={editable} />));
const select = () => container.querySelector<HTMLSelectElement>("select")!;
const save = () => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Sav")) as HTMLButtonElement;
function choose(value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  act(() => {
    setter.call(select(), value);
    select().dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const status = () => container.querySelector('[role="status"]')!.textContent;

describe("HomeSizeCard", () => {
  it("shows the booking's size in a labelled select, with all four choices", () => {
    mount("1800-2500");
    const label = container.querySelector(`label[for="${select().id}"]`)!;
    expect(label.textContent).toBe("About how big is the home?");
    expect(select().value).toBe("1800-2500");
    expect([...select().options].map((o) => o.textContent)).toEqual([
      "Under 1,800 sq ft",
      "1,800 to 2,500 sq ft",
      "2,500 sq ft or more",
      "Not sure",
    ]);
  });

  it("says 'Not recorded' for a booking made before size was asked, and won't let Save clear it", () => {
    mount(null);
    expect(select().value).toBe("");
    expect(select().selectedOptions[0].textContent).toBe("Not recorded");
    expect(select().selectedOptions[0].disabled).toBe(true);
    expect(save().disabled).toBe(true);
  });

  it("keeps Save off until the size actually changes", () => {
    mount("unsure");
    expect(save().disabled).toBe(true);
    choose("over-2500");
    expect(save().disabled).toBe(false);
    choose("unsure");
    expect(save().disabled).toBe(true);
  });

  it("saves the new size for this booking, says so, and refreshes the page", async () => {
    mount("unsure");
    choose("under-1800");
    await act(async () => save().click());
    expect(updateHomeSize).toHaveBeenCalledWith(ID, "under-1800");
    expect(status()).toBe("Saved.");
    expect(refresh).toHaveBeenCalled();
  });

  it("sets a size on a booking that had none", async () => {
    mount(null);
    choose("1800-2500");
    await act(async () => save().click());
    expect(updateHomeSize).toHaveBeenCalledWith(ID, "1800-2500");
  });

  it("shows the reason, and no 'Saved.', when it can't save", async () => {
    updateHomeSize.mockResolvedValue({ success: false, error: "This booking no longer exists." });
    mount("unsure");
    choose("over-2500");
    await act(async () => save().click());
    expect(container.querySelector('[role="alert"]')!.textContent).toBe("This booking no longer exists.");
    expect(status()).toBe("");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("takes back 'Saved.' as soon as the choice changes again", async () => {
    mount("unsure");
    choose("over-2500");
    await act(async () => save().click());
    choose("under-1800");
    expect(status()).toBe("");
  });

  it("disables Save while saving", async () => {
    let finish!: (r: Result) => void;
    updateHomeSize.mockReturnValue(new Promise<Result>((resolve) => (finish = resolve)));
    mount("unsure");
    choose("over-2500");
    act(() => save().click());
    expect(save().disabled).toBe(true);
    expect(save().textContent).toBe("Saving…");
    await act(async () => finish({ success: true }));
    expect(save().textContent).toBe("Save");
  });

  it("is read-only once the booking is finished or cancelled, and says why", () => {
    mount("over-2500", false);
    expect(container.querySelector("select")).toBeNull();
    expect(container.textContent).toContain("2,500 sq ft or more");
    expect(container.textContent).toContain("can't be changed on a finished or cancelled booking");
  });

  it("reads 'Not recorded' in the read-only view of an old booking", () => {
    mount(null, false);
    expect(container.textContent).toContain("Not recorded");
  });

  it("explains that 'Not sure' counts as a large home", () => {
    mount("unsure");
    expect(container.textContent).toContain("counts as a large home");
  });
});
