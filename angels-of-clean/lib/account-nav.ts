export interface AccountNavItem {
  href: string;
  label: string;
}

// The portal's pages, in order. Each phase of the portal adds its own entries
// here as the page exists, so the nav never links to a page that isn't there.
export function accountNav(): AccountNavItem[] {
  return [
    { href: "/account", label: "Overview" },
    { href: "/account/visits", label: "Visits" },
    { href: "/account/billing", label: "Billing" },
  ];
}

// Overview is only current on /account itself; every other entry owns its subpages.
export function isCurrentNavItem(pathname: string, href: string): boolean {
  return href === "/account"
    ? pathname === "/account"
    : pathname === href || pathname.startsWith(`${href}/`);
}
