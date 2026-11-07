"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import Container from "@/components/site/Container";
import CtaLink from "@/components/site/CtaLink";
import { BUSINESS_PHONE } from "@/lib/constants";
import { NAV_LINKS } from "@/lib/site-content";
import { cn } from "@/lib/utils";

// Marketing header (Figma "Marketing — … — Desktop / Mobile"): logo, the four
// pages, the phone number and the booking button; a menu button below 1024px.
function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Escape closes the open menu and puts focus back on its button.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const linkClass = (href: string) =>
    cn(
      "inline-flex min-h-11 items-center text-sm font-medium hover:text-primary",
      isCurrent(pathname, href) ? "text-primary" : "text-ink",
    );

  return (
    <header className="border-b border-line bg-white">
      <Container className="flex h-14 items-center justify-between lg:h-18">
        <Link href="/" className="flex items-center">
          <Image
            src="/AngelsOfCleanLogoSVG.svg"
            alt="Angels of Clean"
            width={220}
            height={100}
            className="h-[46px] w-auto lg:h-[60px]"
            priority
          />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
              className={linkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          <a
            href={BUSINESS_PHONE.tel}
            className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-primary"
          >
            <span className="sr-only">Call us: </span>
            {BUSINESS_PHONE.display}
          </a>
          <CtaLink href="/residential" size="nav">
            Book a cleaning
          </CtaLink>
        </div>

        <button
          ref={menuButton}
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-ink lg:hidden"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          {open ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
        </button>
      </Container>

      <nav id="mobile-nav" aria-label="Mobile" hidden={!open} className="border-t border-line bg-white lg:hidden">
        <Container className="flex flex-col py-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={cn(linkClass(link.href), "min-h-12 text-base")}
            >
              {link.label}
            </Link>
          ))}
          <a href={BUSINESS_PHONE.tel} className="inline-flex min-h-12 items-center text-base text-ink-muted">
            <span className="sr-only">Call us: </span>
            {BUSINESS_PHONE.display}
          </a>
          <div className="py-3">
            <CtaLink href="/residential" size="hero">
              Book a cleaning
            </CtaLink>
          </div>
        </Container>
      </nav>
    </header>
  );
}
