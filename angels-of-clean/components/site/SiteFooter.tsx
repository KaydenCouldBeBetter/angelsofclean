import Link from "next/link";
import Container from "@/components/site/Container";
import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_FACEBOOK_URL,
  BUSINESS_HOURS,
  BUSINESS_PHONE,
} from "@/lib/constants";
import { SERVICE_AREA_TOWNS } from "@/lib/homepage-content";
import { FOOTER_LINKS } from "@/lib/site-content";

// Footer shared by every marketing page. Figma sets the brand name and the
// Facebook link in the standard brand teal on this dark background (2.7:1), so
// they use the lighter --primary-on-dark teal (7.6:1) instead.
const columnHeading = "text-sm font-semibold text-footer-heading";
const linkBase = "inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline md:min-h-8";
const link = `${linkBase} text-footer-muted hover:text-white`;

export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-ink pt-12 pb-8 md:pt-16">
      <Container className="flex flex-col gap-8">
        <div className="grid gap-8 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <p className="text-xl font-semibold text-primary-on-dark">Angels of Clean</p>
            <p className="text-sm text-footer-muted">Pure Clean, Divinely Inspired.</p>
            <a href={BUSINESS_FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className={`${linkBase} w-fit text-primary-on-dark`}>
              Facebook<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <p className="text-sm text-footer-muted">
              We’re hiring! Send your resume to{" "}
              <a href={`mailto:${BUSINESS_EMAIL}`} className="underline underline-offset-4 hover:text-white">
                {BUSINESS_EMAIL}
              </a>
            </p>
          </div>

          <nav aria-labelledby="footer-quick-links" className="flex flex-col gap-1">
            <h2 id="footer-quick-links" className={`${columnHeading} mb-2`}>
              Quick Links
            </h2>
            {FOOTER_LINKS.map((item) => (
              <Link key={item.label} href={item.href} className={link}>
                {item.label}
              </Link>
            ))}
          </nav>

          <section aria-labelledby="footer-service-areas" className="flex flex-col gap-3">
            <h2 id="footer-service-areas" className={columnHeading}>
              Service Areas
            </h2>
            <ul className="flex flex-col gap-3 text-sm text-footer-muted">
              {SERVICE_AREA_TOWNS.map(({ town }) => (
                <li key={town}>{town}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="footer-contact" className="flex flex-col gap-1">
            <h2 id="footer-contact" className={`${columnHeading} mb-2`}>
              Contact
            </h2>
            <a href={BUSINESS_PHONE.tel} className={link}>
              {BUSINESS_PHONE.display}
            </a>
            <a href={`mailto:${BUSINESS_EMAIL}`} className={link}>
              {BUSINESS_EMAIL}
            </a>
            <p className="py-1 text-sm text-footer-muted">{BUSINESS_ADDRESS}</p>
            {BUSINESS_HOURS.map((line) => (
              <p key={line} className="py-1 text-sm text-footer-muted">
                {line}
              </p>
            ))}
          </section>
        </div>

        <div className="flex flex-col items-center gap-2 text-xs text-footer-muted md:flex-row md:justify-center md:gap-6">
          <p>© 2026 Angels of Clean. All rights reserved.</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-white">
              Terms of Service
            </Link>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
