// Trust content for the marketing site (backlog B27): the homepage, About and
// Areas & Reviews pages. Everything the site says about the business's
// reputation lives in this one file. An entry marked `placeholder: true` is not
// real yet: the page shows it with a visible "Placeholder" label so nobody
// mistakes it for the real thing.
//
// How to replace each placeholder:
//   - Photos (hero, about): put the image in public/home/ (for example
//     public/home/about.jpg), set `src` to "/home/about.jpg" and write an `alt`
//     that describes the photo (what it shows, not "photo"). There is no team
//     section: the owner cut it on 2026-11-10 (see docs/DECISIONS.md).
//   - Service area map: done. components/site/ServiceAreaMap.tsx draws a real
//     OpenStreetMap map from SERVICE_AREA_COORDS below.
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
  /**
   * Optional different images for tablet (768px and up) and desktop (1024px and
   * up). `src` is then the phone image. Each is shown at its own screen size.
   */
  responsive?: { tablet: string; desktop: string };
  /** "cover" (default) crops the photo to fill its box; "contain" shrinks it so the whole image shows. */
  fit?: "cover" | "contain";
  placeholder: boolean;
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
  hero: {
    id: "hero",
    src: "/home/hero-phone-85c24e.png",
    responsive: { tablet: "/home/hero-tablet-a0df82.png", desktop: "/home/hero-desktop-977d63.png" },
    alt: "We're hiring: experienced cleaning technicians for window, carpet and commercial cleaning in Liverpool, NY, Monday to Friday, full and part time. Apply at angelsofcleanct@gmail.com.",
    placeholder: false,
  },
  about: {
    id: "about",
    src: "/home/about-services-flyer.jpg",
    alt: "Angels of Clean cleaning services flyer: three job photos (a clean bathtub, a polished tile floor, a cleaner using a carpet cleaning hose), the service types Residential, Commercial, Flooring and Carpets, and a note that customised packages are available.",
    fit: "contain",
    placeholder: false,
  },
};

/** The Areas page shows a grey "Service Area Map" box until a real map is built. */
export const SERVICE_AREA_MAP = { placeholder: false };

export interface PlaceholderEntry {
  section: "reviews" | "trust badges" | "photos" | "service area map";
  id: string;
}

/** Every entry still marked `placeholder: true`, in page order. */
export function listPlaceholders(): PlaceholderEntry[] {
  return [
    ...HOMEPAGE_REVIEWS.filter((r) => r.placeholder).map((r) => ({ section: "reviews" as const, id: r.id })),
    ...HOMEPAGE_TRUST_BADGES.filter((b) => b.placeholder).map((b) => ({ section: "trust badges" as const, id: b.id })),
    ...Object.values(SITE_PHOTOS).filter((p) => p.placeholder).map((p) => ({ section: "photos" as const, id: p.id })),
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

// Where each town's pin goes on the Areas page map (latitude, longitude, in
// degrees). Approximate town centres, good enough for a pin at this zoom.
// Keyed by the `town` names above; a test fails if one is missing.
export const SERVICE_AREA_COORDS: Record<string, [lat: number, lng: number]> = {
  Cicero: [43.1723, -76.1166],
  Camillus: [43.0412, -76.305],
  Syracuse: [43.0481, -76.1474],
  Liverpool: [43.1065, -76.2177],
  Baldwinsville: [43.1587, -76.333],
  Brewerton: [43.2395, -76.1397],
  Solvay: [43.0587, -76.2102],
  Manlius: [43.0003, -75.9763],
  Marcellus: [42.984, -76.338],
};

/** The town the company is based in. Its pin is drawn larger on the map. */
export const HOME_BASE_TOWN = "Liverpool";
