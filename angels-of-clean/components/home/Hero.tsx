import Container from "@/components/site/Container";
import CtaLink from "@/components/site/CtaLink";
import Photo from "@/components/site/Photo";
import { HOMEPAGE_HERO_FACTS, SITE_PHOTOS } from "@/lib/homepage-content";

// Figma "Marketing — Home": one headline, a row of short claims, exactly two
// paths (a home cleaning you book, a commercial quote you request) and a photo.
export default function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="bg-white">
      <Container className="flex flex-col py-12 lg:h-150 lg:flex-row lg:items-center lg:gap-6 lg:py-0">
        <div className="flex flex-1 flex-col justify-center">
          <h1
            id="hero-heading"
            className="text-[32px] leading-[38.4px] font-bold text-ink md:text-5xl md:leading-[54px] xl:text-[56px] xl:leading-[62px]"
          >
            <span className="block">Pure Clean,</span> <span className="block">Divinely Inspired</span>
          </h1>
          <p className="mt-3 max-w-xl text-base text-ink-muted md:mt-5 md:text-lg md:leading-7">
            Maintain purity inside and outside your home or office with the cleaning crew you can count on.
          </p>

          <ul aria-label="Why customers trust us" className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-medium text-ink-muted md:gap-4">
            {HOMEPAGE_HERO_FACTS.map((fact) => (
              <li key={fact} className="md:rounded-3xl md:border md:border-line md:bg-surface-tint md:px-3 md:py-1">
                {fact}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
            <CtaLink href="/residential">Book a cleaning</CtaLink>
            <CtaLink href="/commercial" tone="outline">
              Get a commercial quote
            </CtaLink>
          </div>
        </div>

        <Photo photo={SITE_PHOTOS.hero} className="mt-6 h-50 md:h-80 lg:mt-0 lg:h-full lg:w-[40%] xl:w-121" />
      </Container>
    </section>
  );
}
