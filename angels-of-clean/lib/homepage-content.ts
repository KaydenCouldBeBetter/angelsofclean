// Trust content for the marketing site (backlog B27): the homepage, About and
// Areas & Reviews pages. Everything the site says about the business's
// reputation lives in this one file. An entry marked `placeholder: true` is not
// real yet: the page shows it with a visible "Placeholder" label so nobody
// mistakes it for the real thing.
//
// How to replace each placeholder:
//   - Photos (hero, about, team): put the image in public/home/ (for example
//     public/home/team-1.jpg), set `src` to "/home/team-1.jpg", write an `alt`
//     that describes the photo (who and what, not "photo"), and for a team
//     member set `name` and `role`. Use a real person's name only with their
//     consent.
//   - Service area map: set `SERVICE_AREA_MAP.placeholder` to false once a real
//     map is added in components/site/ServiceAreaMap.tsx.
//   - Reviews: only real reviews, in the customer's own words.
//   - Then set `placeholder: false` on that entry. The "Placeholder" label goes
//     away on its own. `hasPlaceholders` turns false once none are left.
//
// `hasPlaceholders` never blocks the build. lib/__tests__/homepage-content.test.ts
// prints which placeholders remain so you can see what is left to replace.

export interface ReviewContent {
  id: string;
  quote: string;
  author: string;
  placeholder: boolean;
  /** True for the three reviews the homepage shows; the Areas page shows all of them. */
  onHomepage: boolean;
  /**
   * A short phrase from the quote, shown in bold teal. It must appear in `quote`
   * word for word (a test checks), so it only ever emphasises the customer's own words.
   */
  highlight?: string;
  /** The one review shown as a solid teal card. At most one review sets this. */
  featured?: boolean;
}

export interface TrustBadgeContent {
  id: "ahca-certified" | "ahca-member" | "tenth-year" | "liverpool";
  /** The full label (desktop trust row). */
  label: string;
  /** The short label for the two-by-two mobile grid. */
  shortLabel: string;
  placeholder: boolean;
}

export interface PhotoContent {
  id: string;
  /** Path under public/, e.g. "/home/team-1.jpg". `null` shows the labelled grey box. */
  src: string | null;
  /** Describes the photo. Ignored while `src` is null (the box is labelled instead). */
  alt: string;
  placeholder: boolean;
}

export interface TeamMemberContent extends PhotoContent {
  name: string;
  role: string;
}

export const HOMEPAGE_REVIEWS: ReviewContent[] = [
  {
    id: "heather-w",
    quote:
      "Thank you from the top of my ceiling fans to the bottom of my baseboards!!! House looks amazing! Could not ask for a better way to kick the last of winter out. Thank you, Angels!",
    author: "Heather W.",
    placeholder: false,
    onHomepage: true,
    highlight: "House looks amazing!",
    featured: true,
  },
  {
    id: "audrey-g",
    quote: "Fabulous cleaning team. Did a super job with our move-out clean up!",
    author: "Audrey G.",
    placeholder: false,
    onHomepage: true,
    highlight: "Fabulous cleaning team.",
  },
  {
    id: "michelle-b",
    quote: "Professional, efficient and friendly service",
    author: "Michelle B.",
    placeholder: false,
    onHomepage: false,
    highlight: "Professional, efficient and friendly",
  },
  {
    id: "cathy-d",
    quote:
      "The Angels of Clean crews have consistently done a great job. I have used them for over 2 years and highly recommend them for your cleaning needs.",
    author: "Cathy D.",
    placeholder: false,
    onHomepage: true,
    highlight: "highly recommend them",
  },
];

export const HOMEPAGE_TRUST_BADGES: TrustBadgeContent[] = [
  { id: "ahca-certified", label: "AHCA-Certified Cleaners", shortLabel: "AHCA Certified", placeholder: false },
  { id: "ahca-member", label: "AHCA Member in Good Standing", shortLabel: "AHCA Member", placeholder: false },
  { id: "tenth-year", label: "10th Year in Business", shortLabel: "10th Year", placeholder: false },
  { id: "liverpool", label: "Based in Liverpool, NY", shortLabel: "Liverpool, NY", placeholder: false },
];

/** The short claims under the hero headline. */
export const HOMEPAGE_HERO_FACTS = [
  "AHCA-certified team",
  "In our 10th year",
  "Residential & commercial",
  "Liverpool, NY",
] as const;

export const SITE_PHOTOS: { hero: PhotoContent; about: PhotoContent } = {
  hero: { id: "hero", src: null, alt: "Team photo", placeholder: true },
  about: { id: "about", src: null, alt: "Team photo", placeholder: true },
};

export const TEAM_MEMBERS: TeamMemberContent[] = [1, 2, 3, 4].map((n) => ({
  id: `team-${n}`,
  src: null,
  alt: "Team photo",
  name: `[Team Member ${n}]`,
  role: "[Role]",
  placeholder: true,
}));

/** The Areas page shows a grey "Service Area Map" box until a real map is built. */
export const SERVICE_AREA_MAP = { placeholder: true };

export interface PlaceholderEntry {
  section: "reviews" | "trust badges" | "photos" | "team photos" | "service area map";
  id: string;
}

/** Every entry still marked `placeholder: true`, in page order. */
export function listPlaceholders(): PlaceholderEntry[] {
  return [
    ...HOMEPAGE_REVIEWS.filter((r) => r.placeholder).map((r) => ({ section: "reviews" as const, id: r.id })),
    ...HOMEPAGE_TRUST_BADGES.filter((b) => b.placeholder).map((b) => ({ section: "trust badges" as const, id: b.id })),
    ...Object.values(SITE_PHOTOS).filter((p) => p.placeholder).map((p) => ({ section: "photos" as const, id: p.id })),
    ...TEAM_MEMBERS.filter((m) => m.placeholder).map((m) => ({ section: "team photos" as const, id: m.id })),
    ...(SERVICE_AREA_MAP.placeholder ? [{ section: "service area map" as const, id: "map" }] : []),
  ];
}

/** True while any review, badge, photo or the map is still a placeholder. */
export const hasPlaceholders: boolean = listPlaceholders().length > 0;

// ── Not trust content ────────────────────────────────────────────────────────
// The towns the company serves, with their ZIPs and the short description the
// Areas page shows under each. These are facts the booking flow already
// enforces, not placeholders. The ZIPs must equal SERVICE_AREA_ZIPS in
// lib/constants.ts (a test fails if they drift); the order matches the Figma
// frames.
export const SERVICE_AREA_TOWNS: { town: string; note: string; zips: string[] }[] = [
  { town: "Cicero", note: "North of Syracuse", zips: ["13039"] },
  { town: "Camillus", note: "West side coverage", zips: ["13031"] },
  {
    town: "Syracuse",
    note: "City & suburbs",
    zips: [
      "13201", "13202", "13203", "13204", "13205", "13206", "13207",
      "13208", "13210", "13214", "13215", "13219", "13224",
    ],
  },
  { town: "Liverpool", note: "Our home base", zips: ["13088", "13090"] },
  { town: "Baldwinsville", note: "Northwest reach", zips: ["13027"] },
  { town: "Brewerton", note: "North coverage", zips: ["13029"] },
  { town: "Solvay", note: "Near west side", zips: ["13209"] },
  { town: "Manlius", note: "East side coverage", zips: ["13104"] },
  { town: "Marcellus", note: "Southwest reach", zips: ["13108"] },
];
