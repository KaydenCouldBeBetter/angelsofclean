import Section from "@/components/home/Section";
import { SERVICE_AREA_TOWNS } from "@/lib/homepage-content";

export default function ServiceArea() {
  return (
    <Section
      id="service-area"
      title="Where we clean"
      intro="We serve these towns around Syracuse. You'll enter your ZIP code when you book, and we'll tell you right away if we can't reach you yet."
    >
      <ul aria-label="Towns we serve" className="flex flex-wrap gap-2">
        {SERVICE_AREA_TOWNS.map(({ town }) => (
          <li
            key={town}
            className="rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-zinc-900"
          >
            {town}
          </li>
        ))}
      </ul>
    </Section>
  );
}
