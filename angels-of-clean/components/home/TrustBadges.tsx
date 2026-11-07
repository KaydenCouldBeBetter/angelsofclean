import { Award, BadgeCheck, CalendarCheck, MapPin, type LucideIcon } from "lucide-react";
import Band from "@/components/site/Band";
import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import { HOMEPAGE_TRUST_BADGES, type TrustBadgeContent } from "@/lib/homepage-content";

const ICONS: Record<TrustBadgeContent["id"], LucideIcon> = {
  "ahca-certified": Award,
  "ahca-member": BadgeCheck,
  "tenth-year": CalendarCheck,
  liverpool: MapPin,
};

// The four credentials under the hero: a two-by-two grid on a phone, one row on
// a desktop. Mobile shows the short label, desktop the full one.
export default function TrustBadges() {
  return (
    <Band tone="tint" label="Credentials" className="py-8 md:py-12">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4 lg:gap-6">
        {HOMEPAGE_TRUST_BADGES.map((badge) => {
          const Icon = ICONS[badge.id];
          return (
            <li
              key={badge.id}
              className="flex min-h-14 items-center justify-center gap-2 rounded-3xl border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink md:px-4 md:text-sm md:leading-5"
            >
              <Icon aria-hidden="true" className="size-6 shrink-0 text-primary md:size-7" />
              <span className="md:hidden">{badge.shortLabel}</span>
              <span className="hidden md:inline">{badge.label}</span>
              {badge.placeholder && <PlaceholderBadge />}
            </li>
          );
        })}
      </ul>
    </Band>
  );
}
