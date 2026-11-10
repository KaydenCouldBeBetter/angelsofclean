import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

let pathname = "/account";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
vi.mock("@/app/(customer-auth)/actions", () => ({ customerSignOut: vi.fn() }));

import AccountShell from "../AccountShell";
import { accountNav } from "@/lib/account-nav";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  pathname = "/account";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (name: string | null = "Alice Adams") =>
  act(() =>
    root.render(
      <AccountShell accountName={name} nav={accountNav()}>
        <h1>Page</h1>
      </AccountShell>,
    ),
  );

describe("AccountShell", () => {
  it("has a skip link to one main landmark, and one labelled nav", () => {
    render();
    expect(container.querySelector('a[href="#main"]')?.textContent).toBe("Skip to content");
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector("main")!.id).toBe("main");
    expect(container.querySelectorAll("nav")).toHaveLength(1);
    expect(container.querySelector("nav")!.getAttribute("aria-label")).toBe("Account");
  });

  it("links every nav entry and marks only the current page", () => {
    pathname = "/account/visits/abc";
    render();
    const links = [...container.querySelectorAll("nav a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(accountNav().map((i) => i.href));
    const current = links.filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual(["Visits"]);
  });

  it("marks Overview on /account", () => {
    render();
    const current = [...container.querySelectorAll('nav [aria-current="page"]')];
    expect(current.map((a) => a.textContent)).toEqual(["Overview"]);
  });

  it("says who is signed in, and renders without a name when the lookup failed", () => {
    render();
    expect(container.textContent).toContain("Signed in as Alice Adams");
    act(() => root.unmount());
    root = createRoot(container);
    render(null);
    expect(container.textContent).not.toContain("Signed in as");
  });

  it("offers sign out in a form, on both layouts, as a real button", () => {
    render();
    const buttons = [...container.querySelectorAll("form button")].filter((b) => b.textContent?.includes("Sign out"));
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect((b as HTMLButtonElement).type).toBe("submit");
  });

  it("links the logo home with a name", () => {
    render();
    expect(container.querySelector('a[href="/"] img')?.getAttribute("alt")).toBe("Angels of Clean, home");
  });

  it("renders the page inside main", () => {
    render();
    expect(container.querySelector("main h1")?.textContent).toBe("Page");
  });

  it("gives every nav link a 44px target", () => {
    render();
    for (const a of container.querySelectorAll("nav a")) expect(a.className).toContain("min-h-11");
  });
});
