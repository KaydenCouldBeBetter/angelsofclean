import type { Metadata } from "next";
import { Check } from "lucide-react";
import Band from "@/components/site/Band";
import CtaBand from "@/components/site/CtaBand";
import Photo from "@/components/site/Photo";
import SectionHeading from "@/components/site/SectionHeading";
import TeamGrid from "@/components/site/TeamGrid";
import { SITE_PHOTOS, TEAM_MEMBERS } from "@/lib/homepage-content";
import { ABOUT_PRINCIPLES, AHCA_TRAINING } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "About",
  description:
    "Angels of Clean is an AHCA-certified cleaning company based in Liverpool, NY, now in its 10th year serving homes and businesses across Central New York.",
};

const body = "text-base text-ink-muted md:text-lg md:leading-[29px]";

// Figma "Marketing — About" (desktop 671:70, mobile 670:70).
export default function AboutPage() {
  return (
    <>
      <Band labelledBy="about-heading">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-6">
          <div className="flex flex-1 flex-col gap-6">
            <SectionHeading id="about-heading" as="h1" align="left">
              Cleaning with Intention
            </SectionHeading>
            <p className={body}>
              Angels of Clean team members take pride in providing skilled and exceptional cleaning services, promoting
              indoor air quality and health for every family and business we serve. We use the safest and most effective
              methods to make indoor environments not only clean, but peaceful — by addressing the small, but significant
              details.
            </p>
            <p className={body}>
              Professional cleaning is a skilled trade. Proper cleaning and sanitation have been recognized since the
              1840s as a leading factor in preventing infection and disease — and today we know it has a significant
              impact on mental and emotional health, too.
            </p>
            <p className={body}>
              Now in our 10th year, we clean homes and businesses across Central New York from our base in Liverpool, NY.
            </p>
          </div>
          <Photo photo={SITE_PHOTOS.about} className="h-60 lg:h-100 lg:flex-1" />
        </div>
      </Band>

      <Band tone="tint" labelledBy="ahca-heading">
        <div className="flex flex-col items-start gap-6">
          <SectionHeading id="ahca-heading" size="md" align="left">
            AHCA Certified Professionals
          </SectionHeading>
          <p className={body}>
            We are proud members in good standing with the American House Cleaners Association, a nationally recognized
            professional cleaning community. Every team member is a certified AHCA Professional Cleaning Provider,
            trained in:
          </p>
          <ul className="flex flex-col gap-3">
            {AHCA_TRAINING.map((item) => (
              <li key={item} className="flex items-start gap-3 text-base text-ink md:text-lg md:leading-[29px]">
                <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" strokeWidth={3} />
                {item}
              </li>
            ))}
          </ul>
          <p className="inline-flex min-h-12 items-center rounded-3xl bg-primary px-6 text-sm font-semibold text-white">
            Member in Good Standing — AHCA
          </p>
        </div>
      </Band>

      <Band labelledBy="team-heading">
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="team-heading"
            intro="Every team member is a trained, educated professional who understands the science behind effective, safe cleaning."
          >
            Meet the Team
          </SectionHeading>
          <TeamGrid members={TEAM_MEMBERS} />
        </div>
      </Band>

      <Band tone="tint" labelledBy="principles-heading">
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="principles-heading"
            size="md"
            intro="Each home, business, family and project is unique. Here’s how we deliver worry-free cleaning every time."
          >
            How We Make Sure Things Go Right
          </SectionHeading>
          <ul className="grid gap-4 md:gap-6 lg:grid-cols-3">
            {ABOUT_PRINCIPLES.map((item) => (
              <li key={item.title} className="flex flex-col gap-3 rounded-xl bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] md:p-8">
                <h3 className="text-lg font-semibold text-ink md:leading-[26px]">{item.title}</h3>
                <p className={body}>{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      <CtaBand
        id="about-cta-heading"
        title="Ready to Experience the Difference?"
        button={{ label: "Book a cleaning", href: "/residential" }}
        link={{ label: "Or request a commercial quote", href: "/commercial" }}
      />
    </>
  );
}
