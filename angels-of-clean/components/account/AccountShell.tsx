"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, LogOut, Receipt } from "lucide-react";
import { customerSignOut } from "@/app/(customer-auth)/actions";
import { isCurrentNavItem, type AccountNavItem } from "@/lib/account-nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof CalendarDays> = {
  "/account": LayoutDashboard,
  "/account/visits": CalendarDays,
  "/account/billing": Receipt,
};

// The customer portal's frame (same tokens as the marketing site and booking
// flow: surface-tint page, white cards, brand teal for the current page). On a
// phone it is a header with a row of tabs; from 1024px up, a sidebar. One
// landmark per region, a skip link, and 44px targets throughout.
export default function AccountShell({
  accountName,
  nav,
  children,
}: {
  accountName: string | null;
  nav: AccountNavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface-tint lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary"
      >
        Skip to content
      </a>

      <aside className="border-b border-line bg-white lg:flex lg:min-h-screen lg:w-64 lg:flex-shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 lg:flex-col lg:items-start lg:px-6 lg:pt-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/AngelsOfCleanLogoSVG.svg"
              alt="Angels of Clean, home"
              width={220}
              height={100}
              className="h-[48px] w-auto lg:h-[60px]"
              priority
            />
          </Link>
          <form action={customerSignOut} className="lg:hidden">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-muted hover:text-primary"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </button>
          </form>
        </div>

        {accountName && (
          <p className="mt-2 truncate px-4 text-sm text-ink-muted lg:mt-4 lg:px-6">
            <span className="sr-only">Signed in as </span>
            {accountName}
          </p>
        )}

        <nav aria-label="Account" className="px-2 pb-2 pt-1 lg:flex-1 lg:px-3 lg:pt-4">
          <ul className="flex gap-1 lg:flex-col">
            {nav.map((item) => {
              const current = isCurrentNavItem(pathname, item.href);
              const Icon = ICONS[item.href];
              return (
                <li key={item.href} className="flex-1 lg:flex-none">
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium lg:justify-start",
                      current
                        ? "bg-primary/5 font-semibold text-primary"
                        : "text-ink hover:bg-surface-tint hover:text-primary",
                    )}
                  >
                    {Icon && <Icon aria-hidden="true" className="size-4" />}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <form action={customerSignOut} className="hidden px-3 pb-6 lg:block">
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-surface-tint hover:text-primary"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </form>
      </aside>

      <main id="main" className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
