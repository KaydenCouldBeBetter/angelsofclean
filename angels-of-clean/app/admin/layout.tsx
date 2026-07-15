"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Calendar",  href: "/admin/calendar"  },
  { label: "Bookings",  href: "/admin/bookings"  },
  { label: "Employees", href: "/admin/employees" },
  { label: "Settings",  href: "/admin/settings"  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f5]">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col h-full bg-[#1b3b36]">
        {/* Brand */}
        <div className="px-6 pt-5 pb-4">
          <p className="text-white font-bold text-base leading-tight">Angels of Clean</p>
          <p className="text-[#7aada3] text-xs mt-0.5">Admin Portal</p>
        </div>

        <div className="h-px bg-white/10 mx-0" />

        {/* Nav */}
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map(({ label, href }) => {
            const isActive =
              pathname === href ||
              (href === "/admin/dashboard" && pathname === "/admin");

            return (
              <Link
                key={label}
                href={href}
                className={`relative flex items-center px-6 h-13 text-sm transition-colors ${
                  isActive
                    ? "bg-white/10 text-white font-medium"
                    : "text-[#7aada3] hover:text-white hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-[3px] bg-[#3ebfb5] rounded-r" />
                )}
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="h-px bg-white/10" />

        {/* Bottom */}
        <div className="px-6 py-4">
          <p className="text-[#7aada3] text-xs">Admin: Jordan L.</p>
          <button className="text-[#3ebfb5] text-xs mt-1 hover:underline">Sign out</button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
