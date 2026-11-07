import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Briefcase, CalendarCheck, Clock, Mail, MapPin, Phone } from "lucide-react";
import CtaLink from "@/components/site/CtaLink";
import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_FACEBOOK_URL,
  BUSINESS_HOURS,
  BUSINESS_PHONE,
} from "@/lib/constants";
import { SERVICE_AREA_TOWNS } from "@/lib/homepage-content";
import { NAV_LINKS } from "@/lib/site-content";

// Phone footer (Figma "Footer/Mobile — Contact card", node 856:70): brand, a
// contact + hours card, page-link pills, service-area chips, the hiring banner
// and Facebook. Figma's icons use the brand teal, which is 2.7:1 on this dark
// card, so they take the lighter --primary-on-dark teal. Figma leaves out the
// Privacy and Terms links; they stay here so every page links to them.
const icon = "size-5 shrink-0 text-primary-on-dark";

// "Mon–Fri: 7:30 AM – 5:00 PM" -> ["Mon–Fri", "7:30 AM – 5:00 PM"]
const hours = BUSINESS_HOURS.map((line) => {
  const split = line.indexOf(": ");
  return [line.slice(0, split), line.slice(split + 2)] as const;
});

export default function MobileFooter() {
  return (
    <div className="flex flex-col items-center gap-7 border-t-4 border-primary px-6 pt-10 text-white md:hidden">
      <div className="flex flex-col items-center gap-2.5">
        <Image src="/AngelsOfCleanLogoSVG.svg" alt="Angels of Clean" width={220} height={100} className="h-13 w-auto" />
        <p className="text-sm text-white/70">Pure Clean, Divinely Inspired.</p>
      </div>

      <section
        aria-labelledby="footer-get-in-touch"
        className="flex w-full flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#2a2a2e] p-5"
      >
        <h2 id="footer-get-in-touch" className="text-lg leading-[25px] font-semibold">
          Get in touch
        </h2>
        <ul className="flex flex-col gap-1">
          <li>
            <a href={BUSINESS_PHONE.tel} className="flex min-h-11 items-center gap-3 underline-offset-4 hover:underline">
              <Phone aria-hidden="true" className={icon} />
              {BUSINESS_PHONE.display} · call or text
            </a>
          </li>
          <li>
            <a href={`mailto:${BUSINESS_EMAIL}`} className="flex min-h-11 items-center gap-3 underline-offset-4 hover:underline">
              <Mail aria-hidden="true" className={icon} />
              {BUSINESS_EMAIL}
            </a>
          </li>
          <li className="flex min-h-11 items-center gap-3">
            <MapPin aria-hidden="true" className={icon} />
            {BUSINESS_ADDRESS}
          </li>
          <li className="flex items-start gap-3">
            <Clock aria-hidden="true" className={icon} />
            <dl className="flex w-58 flex-col gap-1.5 text-sm">
              {hours.map(([days, time]) => (
                <div key={days} className="flex justify-between">
                  <dt className="text-white/70">{days}</dt>
                  <dd className="font-medium">{time}</dd>
                </div>
              ))}
            </dl>
          </li>
        </ul>
        <CtaLink href="/residential" size="nav" className="h-12 w-full gap-2 text-base">
          <CalendarCheck aria-hidden="true" className="size-[18px]" />
          Book a cleaning
        </CtaLink>
        <Link href="/commercial" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline underline-offset-4">
          Commercial? Request a quote
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>

      <nav aria-label="Footer" className="w-full">
        <ul className="flex flex-wrap justify-center gap-2">
          {NAV_LINKS.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex h-11 items-center rounded-full border border-white/30 px-4 text-sm font-medium hover:bg-white/10"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="footer-proudly-serving" className="flex w-full flex-col items-center gap-2.5">
        <h2 id="footer-proudly-serving" className="text-xs tracking-[0.08em] text-white/70 uppercase">
          Proudly serving
        </h2>
        <ul className="flex flex-wrap justify-center gap-1.5">
          {SERVICE_AREA_TOWNS.map(({ town }) => (
            <li key={town} className="rounded-lg bg-white/8 px-2.5 py-1.5 text-sm text-white/90">
              {town}
            </li>
          ))}
        </ul>
      </section>

      <p className="flex w-full flex-col items-center gap-2 rounded-xl bg-[rgba(252,99,103,0.16)] px-4 py-3 text-center text-sm">
        <Briefcase aria-hidden="true" className="size-5 text-[#fc6367]" />
        <span>
          We’re hiring! Send your resume to{" "}
          <a href={`mailto:${BUSINESS_EMAIL}`} className="underline underline-offset-4">
            {BUSINESS_EMAIL}
          </a>
        </span>
      </p>

      <a
        href={BUSINESS_FACEBOOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
      >
        <svg aria-hidden="true" viewBox="0 0 18 18" fill="none" className="size-[18px]">
          <path
            d="M13.5 1.5H11.25C10.2554 1.5 9.30161 1.89509 8.59835 2.59835C7.89509 3.30161 7.5 4.25544 7.5 5.25V7.5H5.25V10.5H7.5V16.5H10.5V10.5H12.75L13.5 7.5H10.5V5.25C10.5 5.05109 10.579 4.86032 10.7197 4.71967C10.8603 4.57902 11.0511 4.5 11.25 4.5H13.5V1.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sr-only">Facebook (opens in a new tab)</span>
      </a>
    </div>
  );
}
