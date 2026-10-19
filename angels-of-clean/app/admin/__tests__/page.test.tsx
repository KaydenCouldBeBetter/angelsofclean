import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../LoginForm", () => ({ default: () => <form aria-label="Sign in" /> }));

import AdminIndexPage from "../page";

async function render(params: Record<string, string | string[] | undefined>) {
  const html = renderToStaticMarkup(
    await AdminIndexPage({ searchParams: Promise.resolve(params) }),
  );
  return new DOMParser().parseFromString(html, "text/html");
}

beforeEach(() => {
  createClient.mockClear();
});

// Middleware has already checked the session (and sent admins on to the
// dashboard), so the page must not make a second auth call.
describe("AdminIndexPage", () => {
  it("shows the sign-in form without calling Auth itself", async () => {
    const doc = await render({});
    expect(doc.querySelector("form[aria-label='Sign in']")).not.toBeNull();
    expect(doc.querySelector("[role=alert]")).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("explains a sign-in that couldn't be verified and offers to try the page again", async () => {
    const doc = await render({ auth: "retry", next: "/admin/bookings?filter=past" });

    const alert = doc.querySelector("[role=alert]");
    expect(alert?.textContent).toContain("We couldn't verify your sign-in");
    expect(alert?.querySelector("svg[aria-hidden=true]")).not.toBeNull();
    const retry = [...doc.querySelectorAll("a")].find((a) => a.textContent === "Try again");
    expect(retry?.getAttribute("href")).toBe("/admin/bookings?filter=past");
    // No login form: Auth is down, so signing in would fail too.
    expect(doc.querySelector("form")).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([undefined, "https://evil.example/admin", "//evil.example"])(
    "sends Try again to /admin when next is %j",
    async (next) => {
      const doc = await render({ auth: "retry", next });
      const retry = [...doc.querySelectorAll("a")].find((a) => a.textContent === "Try again");
      expect(retry?.getAttribute("href")).toBe("/admin");
    },
  );
});
