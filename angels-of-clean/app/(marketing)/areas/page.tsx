import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import Band from "@/components/site/Band";
import CtaLink from "@/components/site/CtaLink";
import ReviewGrid from "@/components/site/ReviewGrid";
import SectionHeading from "@/components/site/SectionHeading";
import ServiceAreaMap from "@/components/site/ServiceAreaMap";
import { BUSINESS_ADDRESS, BUSINESS_EMAIL, BUSINESS_HOURS, BUSINESS_PHONE } from "@/lib/constants";
import { HOMEPAGE_REVIEWS, SERVICE_AREA_TOWNS } from "@/lib/homepage-content";

export const metadata: Metadata = {
  title: "Areas & Reviews",
  description:
    "We clean homes and businesses in Cicero, Camillus, Syracuse, Liverpool, Baldwinsville, Brewerton, Solvay, Manlius and Marcellus. Read what customers say, or get in touch.",
};

const contactRow = "flex items-start gap-3 text-base";

// Figma "Marketing — Areas" (desktop 674:70, mobile 672:70). The Contact section
// is the target of every "Contact" link on the site (/areas#contact).
export default function AreasPage() {
  return (
    <>
      <Band labelledBy="areas-heading">
        <div className="flex flex-col items-center gap-8 text-center">
          <SectionHeading
            id="areas-heading"
            as="h1"
            intro="Professional residential and commercial cleaning across nine communities in the Syracuse metro area."
          >
            Proudly Serving Central New York
          </SectionHeading>
          <ul aria-label="Towns we serve" className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-6">
            {SERVICE_AREA_TOWNS.map(({ town, note }) => (
              <li
                key={town}
                className="flex min-h-18 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-white px-2 py-3"
              >
                <span className="text-base font-semibold text-ink md:text-lg md:leading-[26px]">{town}</span>
                <span className="text-sm text-ink-muted">{note}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-muted">
            Not sure if we serve your area? Call or text{" "}
            <a href={BUSINESS_PHONE.tel} className="font-medium text-primary underline underline-offset-4">
              {BUSINESS_PHONE.display}
            </a>
            .
          </p>
        </div>
      </Band>

      <Band tone="tint" labelledBy="reviews-page-heading">
        <div className="flex flex-col gap-8">
          <SectionHeading id="reviews-page-heading">What Our Clients Say</SectionHeading>
          <ReviewGrid reviews={HOMEPAGE_REVIEWS} columns={4} />
        </div>
      </Band>

      <Band tone="tint" id="contact" labelledBy="contact-heading" className="scroll-mt-4 pt-0 md:pt-0">
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="contact-heading"
            intro="We understand that every home, office or commercial space has unique cleaning needs. Feel free to message or call us with any specifics. Your time is valuable, and we will make sure to get back to you as soon as we can."
          >
            Questions or Comments?
          </SectionHeading>
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-6">
            <div className="flex flex-1 flex-col items-stretch gap-6 md:gap-8 lg:gap-10">
              <CtaLink href="/residential" size="panel">
                Book a Residential Cleaning
              </CtaLink>
              <CtaLink href="/commercial" tone="outline" size="panel">
                Request a Commercial Quote
              </CtaLink>
              <section aria-labelledby="direct-contact-heading" className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] md:p-8">
                <h3 id="direct-contact-heading" className="text-lg font-semibold text-ink md:leading-[26px]">
                  Reach Us Directly
                </h3>
                <div className={contactRow}>
                  <Phone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                  <a href={BUSINESS_PHONE.tel} className="text-primary underline-offset-4 hover:underline">
                    <span className="sr-only">Call us: </span>
                    {BUSINESS_PHONE.display}
                  </a>
                </div>
                <div className={contactRow}>
                  <Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                  <a href={`mailto:${BUSINESS_EMAIL}`} className="text-primary underline-offset-4 hover:underline">
                    <span className="sr-only">Email us: </span>
                    {BUSINESS_EMAIL}
                  </a>
                </div>
                <div className={contactRow}>
                  <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                  <p className="text-ink">{BUSINESS_ADDRESS}</p>
                </div>
                <div className={contactRow}>
                  <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div className="text-ink">
                    <span className="sr-only">Hours: </span>
                    {BUSINESS_HOURS.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              </section>
            </div>
            <div className="flex flex-1 flex-col">
              <ServiceAreaMap />
            </div>
          </div>
        </div>
      </Band>
    </>
  );
}
