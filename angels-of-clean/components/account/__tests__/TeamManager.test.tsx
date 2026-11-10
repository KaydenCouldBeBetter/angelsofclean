import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PendingInvite, TeamMember } from "@/lib/customer-types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

type Result = { success: true } | { success: false; error: string };
const createTeamInvite = vi.fn<(email: string) => Promise<Result | { success: true; token: string }>>();
const revokeTeamInvite = vi.fn<(id: string) => Promise<Result>>();
const removeTeamMember = vi.fn<(id: string) => Promise<Result>>();
vi.mock("@/app/account/team/actions", () => ({
  createTeamInvite: (e: string) => createTeamInvite(e),
  revokeTeamInvite: (id: string) => revokeTeamInvite(id),
  removeTeamMember: (id: string) => removeTeamMember(id),
}));

import TeamManager from "../TeamManager";

const MEMBERS: TeamMember[] = [
  { userId: "u-1", email: "bob@biz.com", role: "owner", joinedLabel: "November 1, 2026" },
  { userId: "u-2", email: "carol@biz.com", role: "member", joinedLabel: "November 5, 2026" },
];
const INVITES: PendingInvite[] = [
  { id: "i-1", email: "dave@biz.com", expiresLabel: "November 12, 2026", expired: false },
  { id: "i-2", email: "old@biz.com", expiresLabel: "November 2, 2026", expired: true },
];
const TOKEN = "A".repeat(43);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  createTeamInvite.mockResolvedValue({ success: true, token: TOKEN });
  revokeTeamInvite.mockResolvedValue({ success: true });
  removeTeamMember.mockResolvedValue({ success: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<TeamManager members={MEMBERS} invites={INVITES} currentEmail="Bob@biz.com" />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.replace(/\s+/g, " ").includes(text)) as
    | HTMLButtonElement
    | undefined;
async function click(el: Element | undefined) {
  if (!el) throw new Error("element not found");
  await act(async () => (el as HTMLElement).click());
}
async function type(id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("TeamManager", () => {
  it("lists members with roles, marks the current user, and offers removal only for members", () => {
    expect(container.textContent).toContain("bob@biz.com");
    expect(container.textContent).toContain("(you)");
    expect(container.textContent).toContain("Owner");
    expect(button("Remove carol@biz.com")).toBeDefined();
    expect(button("Remove bob@biz.com")).toBeUndefined();
  });

  it("shows pending invites, saying which have expired", () => {
    expect(container.textContent).toContain("Expires November 12, 2026");
    expect(container.textContent).toContain("Expired November 2, 2026");
  });

  it("labels its inputs", () => {
    expect(container.querySelector('label[for="invite-email"]')?.textContent).toBe("Email address");
  });

  it("creates an invite and shows its link once, with the site's origin", async () => {
    await type("invite-email", "erin@biz.com");
    await click(button("Create invite link"));
    expect(createTeamInvite).toHaveBeenCalledWith("erin@biz.com");
    const link = container.querySelector<HTMLInputElement>("#invite-link")!;
    expect(link.value).toBe(`${window.location.origin}/signup?invite=${TOKEN}`);
    expect(link.readOnly).toBe(true);
    expect(refresh).toHaveBeenCalled();
    expect((container.querySelector("#invite-email") as HTMLInputElement).value).toBe("");
  });

  it("copies the link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await type("invite-email", "erin@biz.com");
    await click(button("Create invite link"));
    await click(button("Copy link"));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/signup?invite=${TOKEN}`);
    expect(button("Copied")).toBeDefined();
  });

  it("shows the server's reason when an invite is refused, with no link", async () => {
    createTeamInvite.mockResolvedValue({ success: false, error: "That person is already on your team." });
    await type("invite-email", "carol@biz.com");
    await click(button("Create invite link"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("already on your team");
    expect(container.querySelector("#invite-link")).toBeNull();
  });

  it("asks before removing a member, and only then removes", async () => {
    await click(button("Remove carol@biz.com"));
    expect(removeTeamMember).not.toHaveBeenCalled();
    await click(button("Keep"));
    expect(button("Remove carol@biz.com")).toBeDefined();
    await click(button("Remove carol@biz.com"));
    await click(button("Yes, remove carol@biz.com"));
    expect(removeTeamMember).toHaveBeenCalledWith("u-2");
    expect(refresh).toHaveBeenCalled();
  });

  it("cancels a pending invite", async () => {
    await click(button("Cancel invite for dave@biz.com"));
    expect(revokeTeamInvite).toHaveBeenCalledWith("i-1");
  });

  it("shows an error when removing fails", async () => {
    removeTeamMember.mockResolvedValue({ success: false, error: "That person can't be removed. Refresh the page." });
    await click(button("Remove carol@biz.com"));
    await click(button("Yes, remove carol@biz.com"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("can't be removed");
  });
});
