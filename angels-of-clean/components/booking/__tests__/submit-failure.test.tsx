import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import SubmitErrorAlert from "../SubmitErrorAlert";
import ServiceUnavailable from "../ServiceUnavailable";
import DateExpiredNotice from "../DateExpiredNotice";
import { BUSINESS_PHONE } from "@/lib/constants";

describe("BUSINESS_PHONE", () => {
  it("pairs the display text with a matching tel: link", () => {
    expect(BUSINESS_PHONE.display).toBe("(315) 516-1266");
    expect(BUSINESS_PHONE.tel).toBe("tel:+13155161266");
    expect(BUSINESS_PHONE.tel.replace(/\D/g, "")).toContain(
      BUSINESS_PHONE.display.replace(/\D/g, ""),
    );
  });
});

describe("SubmitErrorAlert", () => {
  const html = (retrying: boolean) =>
    renderToStaticMarkup(
      <SubmitErrorAlert title="Not sent" message="Try later." onRetry={() => {}} retrying={retrying} />,
    );

  it("is an alert with a hidden icon, the message, a retry button and a tap-to-call phone", () => {
    const out = html(false);
    expect(out).toContain('role="alert"');
    expect(out).toContain('<svg aria-hidden="true"');
    expect(out).toContain("Not sent");
    expect(out).toContain("Try later.");
    expect(out).toContain(">Try again</button>");
    expect(out).toContain(`href="${BUSINESS_PHONE.tel}"`);
    expect(out).toContain(BUSINESS_PHONE.display);
  });

  it("disables the retry button while a retry is running", () => {
    const out = html(true);
    expect(out).toContain("disabled");
    expect(out).toContain("Trying…");
    expect(out).not.toContain(">Try again<");
  });
});

describe("DateExpiredNotice", () => {
  it("explains the cleared date politely and says nothing else was lost", () => {
    const out = renderToStaticMarkup(<DateExpiredNotice />);
    expect(out).toContain('role="status"');
    expect(out).toContain("Your saved date has passed.");
    expect(out).toContain("Everything else you entered is still saved.");
    expect(out).toContain('<svg aria-hidden="true"');
  });
});

describe("ServiceUnavailable", () => {
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

  it("follows the Figma frame: heading, what happened, Try Again, home, phone", () => {
    act(() =>
      root.render(<ServiceUnavailable subject="booking" onRetry={() => {}} retrying={false} />),
    );
    const text = container.textContent ?? "";
    expect(container.querySelector("h1")!.textContent).toBe("Something went wrong");
    expect(text).toContain("We couldn't complete your request. This is usually temporary.");
    expect(text).toContain("What happened:");
    expect(text).toContain(
      "We couldn't save your booking because our service is temporarily unavailable. Your booking was NOT submitted.",
    );
    // The designed copy said "Error 503", but no HTTP status is involved.
    expect(text).not.toContain("503");
    expect(text).toContain("Return to Homepage");
    expect(text).toContain("Need immediate help?");
    expect(container.querySelector(`a[href="${BUSINESS_PHONE.tel}"]`)!.textContent).toBe(
      BUSINESS_PHONE.display,
    );
  });

  it("moves focus to its heading, since the button that opened it is gone", () => {
    act(() =>
      root.render(<ServiceUnavailable subject="request" onRetry={() => {}} retrying={false} />),
    );
    expect(document.activeElement).toBe(container.querySelector("h1"));
  });

  it("calls onRetry from Try Again and disables it while retrying", () => {
    const onRetry = vi.fn();
    act(() => root.render(<ServiceUnavailable subject="booking" onRetry={onRetry} retrying={false} />));
    const button = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Try Again",
    )!;
    act(() => button.click());
    expect(onRetry).toHaveBeenCalledTimes(1);

    act(() => root.render(<ServiceUnavailable subject="booking" onRetry={onRetry} retrying />));
    const busy = container.querySelector("button")!;
    expect(busy.disabled).toBe(true);
    expect(busy.textContent).toBe("Trying…");
  });
});
