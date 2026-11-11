export interface AccountNavItem {
  href: string;
  label: string;
}

// The portal's pages, in order. Business accounts get the extra pages that only
// make sense for them; the team page is the owner's (members never see it).
// Every href has a page, so the nav never links to one that isn't there.
export function accountNav(
  account?: { type: "residential" | "commercial"; role: "owner" | "member" } | null,
): AccountNavItem[] {
  const items: AccountNavItem[] = [
    { href: "/account", label: "Overview" },
    { href: "/account/visits", label: "Visits" },
    { href: "/account/billing", label: "Billing" },
  ];
  if (account?.type === "commercial") {
    items.push(
      { href: "/account/quotes", label: "Quotes" },
      { href: "/account/locations", label: "Locations" },
    );
    if (account.role === "owner") items.push({ href: "/account/team", label: "Team" });
  }
  return items;
}

// Overview is only current on /account itself; every other entry owns its subpages.
export function isCurrentNavItem(pathname: string, href: string): boolean {
  return href === "/account"
    ? pathname === "/account"
    : pathname === href || pathname.startsWith(`${href}/`);
}
