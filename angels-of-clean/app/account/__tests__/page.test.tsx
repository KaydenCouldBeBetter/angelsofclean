import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/(customer-auth)/actions", () => ({ customerSignOut: vi.fn() }));

const rpc = vi.fn(() => Promise.resolve({ data: { status: "ok" }, error: null }));
let account: { name: string; account_type: string } | null = { name: "Alice Adams", account_type: "residential" };
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      rpc,
      from: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: account }) }) }),
    }),
}));

import AccountPage from "../page";

const render = async (searchParams: { invite?: string } = {}) =>
  renderToStaticMarkup(await AccountPage({ searchParams: Promise.resolve(searchParams) }));

beforeEach(() => {
  vi.clearAllMocks();
  account = { name: "Alice Adams", account_type: "residential" };
});

describe("account page", () => {
  it("greets the customer by their account name and offers sign out", async () => {
    const html = await render();
    expect(html).toContain("Welcome, Alice Adams");
    expect(html).toContain("Sign out");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("picks up bookings made since sign-up", async () => {
    await render();
    expect(rpc).toHaveBeenCalledWith("claim_account_records");
  });

  it("escapes the account name", async () => {
    account = { name: "<img src=x onerror=alert(1)>", account_type: "residential" };
    expect(await render()).not.toContain("<img");
  });

  it("words only the invite notices it knows", async () => {
    expect(await render({ invite: "wrong_email" })).toContain("different email address");
    const unknown = await render({ invite: "<script>alert(1)</script>" });
    expect(unknown).not.toContain("alert(1)");
    expect(unknown).not.toContain('role="status"');
  });
});
