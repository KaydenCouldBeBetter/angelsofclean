import Band from "@/components/site/Band";
import SectionHeading from "@/components/site/SectionHeading";
import ServiceCard from "@/components/site/ServiceCard";
import type { Offering } from "@/lib/site-content";

// One group of offerings on the Services page: a heading, a line of intro and a
// card grid. Cards run three across, so a group of five fills a row of three
// and a row of two.
export default function OfferingSection({
  id,
  anchor,
  tone = "white",
  title,
  intro,
  offerings,
}: {
  id: string;
  anchor?: string;
  tone?: "white" | "tint";
  title: string;
  intro: string;
  offerings: Offering[];
}) {
  return (
    <Band id={anchor} tone={tone} labelledBy={id} className="scroll-mt-4">
      <div className="flex flex-col gap-6 md:gap-8">
        <SectionHeading id={id} align="left" intro={intro}>
          {title}
        </SectionHeading>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-6">
          {offerings.map((offering, index) => (
            <li key={offering.title} className={index < 3 ? "lg:col-span-2" : "lg:col-span-3"}>
              <ServiceCard {...offering} customQuote />
            </li>
          ))}
        </ul>
      </div>
    </Band>
  );
}
