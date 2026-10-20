import Image from "next/image";
import Section from "@/components/home/Section";
import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import { HOMEPAGE_TEAM_PHOTOS } from "@/lib/homepage-content";

export default function TeamPhotos() {
  return (
    <Section id="team" title="Meet the team">
      <ul className="grid gap-4 sm:grid-cols-3">
        {HOMEPAGE_TEAM_PHOTOS.map((member) => (
          <li key={member.id}>
            <figure className="flex flex-col gap-3">
              {member.src ? (
                <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-100">
                  <Image
                    src={member.src}
                    alt={member.alt}
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ) : (
                // The grey stand-in is a labelled image (role="img"), so a screen
                // reader announces "Team photo" instead of skipping it.
                <div
                  role="img"
                  aria-label={member.alt}
                  className="flex aspect-square items-center justify-center rounded-xl bg-zinc-200 text-base font-medium text-zinc-700"
                >
                  Team photo
                </div>
              )}
              <figcaption className="flex flex-col gap-1">
                {member.placeholder && <PlaceholderBadge />}
                <span className="text-base font-semibold text-zinc-900">{member.name}</span>
                <span className="text-sm text-zinc-600">{member.role}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}
