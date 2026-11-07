import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import Photo from "@/components/site/Photo";
import type { TeamMemberContent } from "@/lib/homepage-content";

// Team members from lib/homepage-content.ts: two across on a phone, four on a desktop.
export default function TeamGrid({ members }: { members: TeamMemberContent[] }) {
  return (
    <ul aria-label="Team members" className="grid grid-cols-2 gap-4 md:gap-8 lg:grid-cols-4">
      {members.map((member) => (
        <li key={member.id}>
          <figure className="flex flex-col items-center gap-3 text-center">
            <Photo photo={member} className="h-40 w-full md:h-65" />
            <figcaption className="flex flex-col items-center gap-1 text-sm">
              {/* A grey placeholder box already carries the label; a real photo with unreplaced text needs its own. */}
              {member.placeholder && member.src && <PlaceholderBadge />}
              <span className="font-semibold text-ink">{member.name}</span>
              <span className="text-ink-muted">{member.role}</span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
