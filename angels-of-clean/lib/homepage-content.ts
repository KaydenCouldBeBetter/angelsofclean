// Trust content for the homepage (backlog B27). Everything the page says about
// the business's reputation lives in this one file, and every value below is a
// placeholder until the owner replaces it. Nothing here is a real review, fact
// or photo, and the page labels each one "Placeholder" so nobody mistakes it.
//
// How to replace each one:
//   - Reviews: set `quote` to the customer's own words, `author` to the name they
//     agreed to show, and `location` to their town. Only use real reviews.
//   - Trust facts: set `label` to the exact claim (for example the real rating and
//     review count, or the real insurance and background-check wording) and
//     `detail` to a short explanation, or "" for none. Only state what is true
//     and provable.
//   - Team photos: put the image in public/home/ (for example
//     public/home/team-1.jpg), set `src` to "/home/team-1.jpg", write an `alt`
//     that describes the photo (who and what, not "photo"), and set `name` and
//     `role`. Use the real person's name only with their consent.
//   - Then set `placeholder: false` on that entry. The "Placeholder" label goes
//     away on its own. `hasPlaceholders` turns false once none are left.
//
// `hasPlaceholders` never blocks the build. lib/__tests__/homepage-content.test.ts
// prints which placeholders remain so you can see what is left to replace.

export interface ReviewContent {
  id: string;
  quote: string;
  author: string;
  location: string;
  placeholder: boolean;
}

export interface TrustFactContent {
  id: string;
  label: string;
  detail: string;
  placeholder: boolean;
}

export interface TeamPhotoContent {
  id: string;
  /** Path under public/, e.g. "/home/team-1.jpg". `null` shows the grey box. */
  src: string | null;
  /** Describes the photo. Ignored while `src` is null (the box is labelled instead). */
  alt: string;
  name: string;
  role: string;
  placeholder: boolean;
}

export const HOMEPAGE_REVIEWS: ReviewContent[] = [
  {
    id: "review-1",
    quote: "[Customer review — add real text]",
    author: "[Customer name]",
    location: "[Town]",
    placeholder: true,
  },
  {
    id: "review-2",
    quote: "[Customer review — add real text]",
    author: "[Customer name]",
    location: "[Town]",
    placeholder: true,
  },
  {
    id: "review-3",
    quote: "[Customer review — add real text]",
    author: "[Customer name]",
    location: "[Town]",
    placeholder: true,
  },
];

export const HOMEPAGE_TRUST_FACTS: TrustFactContent[] = [
  {
    id: "rating",
    label: "[Rating and review count — add real numbers]",
    detail: "[Where the reviews come from — add real source]",
    placeholder: true,
  },
  {
    id: "insurance",
    label: "[Insurance fact — add real details]",
    detail: "[What the insurance covers — add real wording]",
    placeholder: true,
  },
  {
    id: "background-checks",
    label: "[Background-check fact — add real details]",
    detail: "[Who is checked and how — add real wording]",
    placeholder: true,
  },
];

export const HOMEPAGE_TEAM_PHOTOS: TeamPhotoContent[] = [
  {
    id: "team-1",
    src: null,
    alt: "Team photo",
    name: "[Team member name]",
    role: "[Role]",
    placeholder: true,
  },
  {
    id: "team-2",
    src: null,
    alt: "Team photo",
    name: "[Team member name]",
    role: "[Role]",
    placeholder: true,
  },
  {
    id: "team-3",
    src: null,
    alt: "Team photo",
    name: "[Team member name]",
    role: "[Role]",
    placeholder: true,
  },
];

export interface PlaceholderEntry {
  section: "reviews" | "trust facts" | "team photos";
  id: string;
}

/** Every entry still marked `placeholder: true`, in page order. */
export function listPlaceholders(): PlaceholderEntry[] {
  return [
    ...HOMEPAGE_REVIEWS.filter((r) => r.placeholder).map((r) => ({ section: "reviews" as const, id: r.id })),
    ...HOMEPAGE_TRUST_FACTS.filter((f) => f.placeholder).map((f) => ({ section: "trust facts" as const, id: f.id })),
    ...HOMEPAGE_TEAM_PHOTOS.filter((p) => p.placeholder).map((p) => ({ section: "team photos" as const, id: p.id })),
  ];
}

/** True while any review, trust fact or team photo is still a placeholder. */
export const hasPlaceholders: boolean = listPlaceholders().length > 0;

// ── Not trust content ────────────────────────────────────────────────────────
// The towns the company serves, with their ZIPs. These are facts the booking
// flow already enforces, not placeholders. The ZIPs must equal
// SERVICE_AREA_ZIPS in lib/constants.ts (a test fails if they drift); the order
// matches the Figma frame.
export const SERVICE_AREA_TOWNS: { town: string; zips: string[] }[] = [
  { town: "Cicero", zips: ["13039"] },
  { town: "Camillus", zips: ["13031"] },
  {
    town: "Syracuse",
    zips: [
      "13201", "13202", "13203", "13204", "13205", "13206", "13207",
      "13208", "13210", "13214", "13215", "13219", "13224",
    ],
  },
  { town: "Liverpool", zips: ["13088", "13090"] },
  { town: "Baldwinsville", zips: ["13027"] },
  { town: "Brewerton", zips: ["13029"] },
  { town: "Solvay", zips: ["13209"] },
  { town: "Manlius", zips: ["13104"] },
  { town: "Marcellus", zips: ["13108"] },
];
