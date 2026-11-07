import type { Metadata } from "next";
import Band from "@/components/site/Band";
import CtaBand from "@/components/site/CtaBand";
import OfferingSection from "@/components/site/OfferingSection";
import SectionHeading from "@/components/site/SectionHeading";
import { BUSINESS_PHONE } from "@/lib/constants";
import { COMMERCIAL_OFFERINGS, RESIDENTIAL_OFFERINGS, SPECIALTY_OFFERINGS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Residential cleaning, commercial cleaning and specialty services (carpet, gutter and window) in Syracuse and Central New York. Every job gets a custom quote.",
};

// Figma "Marketing — Services" (desktop 669:70, mobile 668:70).
export default function ServicesPage() {
  return (
    <>
      <Band tone="tint" labelledBy="services-page-heading">
        <SectionHeading
          id="services-page-heading"
          as="h1"
          intro="Each home, business, family and project is unique. Our goal is to identify your exact needs and develop a professional cleaning plan for you and your home or business."
        >
          Our Cleaning Services
        </SectionHeading>
      </Band>

      <OfferingSection
        id="residential-heading"
        anchor="residential"
        title="Residential Cleaning"
        intro="Customized cleaning for every home, from routine upkeep to move-in/move-out deep cleans."
        offerings={RESIDENTIAL_OFFERINGS}
      />

      <CtaBand
        id="ready-to-book-heading"
        title="Ready to Book?"
        body="Request a cleaning online — we’ll confirm the time and price with you."
        button={{ label: "Book a cleaning", href: "/residential" }}
      />

      <OfferingSection
        id="commercial-heading"
        anchor="commercial"
        tone="tint"
        title="Commercial Cleaning"
        intro="Professional cleaning for offices, retail spaces, and healthcare facilities."
        offerings={COMMERCIAL_OFFERINGS}
      />

      <CtaBand
        id="custom-quote-heading"
        tone="tint"
        title="Need a Custom Quote?"
        body="Your time is valuable — we’ll get back to you as soon as we can."
        button={{ label: "Get a quote", href: "/commercial" }}
      />

      <OfferingSection
        id="specialty-heading"
        anchor="specialty"
        title="Specialty Services"
        intro="Beyond everyday cleaning — call, text or request an estimate."
        offerings={SPECIALTY_OFFERINGS}
      />

      <CtaBand
        id="specialty-cta-heading"
        tone="tint"
        title="Interested in Specialty Services?"
        body={
          <>
            Call or text{" "}
            <a href={BUSINESS_PHONE.tel} className="font-medium text-primary underline underline-offset-4">
              {BUSINESS_PHONE.display}
            </a>{" "}
            for an estimate.
          </>
        }
        button={{ label: "Get an estimate", href: "/areas#contact" }}
      />
    </>
  );
}
