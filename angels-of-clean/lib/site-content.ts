import {
  AppWindow,
  Bath,
  Brush,
  Building2,
  ClipboardList,
  CloudRain,
  PackageOpen,
  SprayCan,
  Sparkles,
  Stethoscope,
  Store,
  type LucideIcon,
} from "lucide-react";

// Navigation, footer links and the offerings on the Services page, from the
// Figma "Marketing Website" page. Pricing is quote-based (B28), so cards say
// "Custom Quote" and never show an amount.

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "About", href: "/about" },
  { label: "Areas & Reviews", href: "/areas" },
] as const;

/** The footer's Quick Links: the nav plus Contact, which is a section of the Areas page. */
export const FOOTER_LINKS = [...NAV_LINKS, { label: "Contact", href: "/areas#contact" }] as const;

/** Where "Get an Estimate" goes: call, text or email, since there is no estimate form. */
export const CONTACT_HREF = "/areas#contact";

export interface Offering {
  title: string;
  description: string;
  icon: LucideIcon;
  cta: { label: string; href: string };
}

const BOOK = { label: "Book Now", href: "/residential" };
const ESTIMATE = { label: "Get an Estimate", href: CONTACT_HREF };
const QUOTE = { label: "Request a Quote", href: "/commercial" };

export const RESIDENTIAL_OFFERINGS: Offering[] = [
  {
    title: "Maintenance Clean",
    description:
      "Regularly scheduled cleanings after your first deep clean — most often bi-weekly, always tailored to you. Kitchens and bathrooms are detailed; living areas, bedrooms and offices are dusted, vacuumed and mopped.",
    icon: Sparkles,
    cta: BOOK,
  },
  {
    title: "Deep Clean",
    description:
      "Top to bottom: cobwebs, dust and debris removed, with special attention to light fixtures, ceiling fans, kitchens (appliances, cabinets, baseboards) and bathrooms. The perfect start before regular maintenance.",
    icon: SprayCan,
    cta: BOOK,
  },
  {
    title: "Move-In / Move-Out & Realtor Special",
    description:
      "We’ll leave your old place spotless and your new one fresh, sanitized and move-in ready — so you can focus on what matters.",
    icon: PackageOpen,
    cta: BOOK,
  },
  {
    title: "Kitchen, Bathroom & Floors",
    description:
      "Pressed for time? We detail your kitchen, bathrooms and floors only, and leave the dusting and organizing to you.",
    icon: Bath,
    cta: ESTIMATE,
  },
  {
    title: "Custom Plan",
    description:
      "Have a unique cleaning situation? We offer flexible, customized plans — including hourly rates. Just ask.",
    icon: ClipboardList,
    cta: ESTIMATE,
  },
];

export const COMMERCIAL_OFFERINGS: Offering[] = [
  {
    title: "Office & Retail",
    description: "Daily, weekly, or custom schedules. Lobbies, restrooms, break rooms, and workspaces.",
    icon: Store,
    cta: QUOTE,
  },
  {
    title: "Medical & Healthcare",
    description:
      "Dusting, sanitizing, floor care, restrooms and breakrooms for medical offices, on a schedule that fits your practice.",
    icon: Stethoscope,
    cta: QUOTE,
  },
  {
    title: "Custom Commercial Plan",
    description:
      "Have a unique facility or schedule? We’ll customize a cleaning and maintenance plan for your business needs.",
    icon: Building2,
    cta: QUOTE,
  },
];

export const SPECIALTY_OFFERINGS: Offering[] = [
  {
    title: "Carpet Cleaning",
    description:
      "Removes deep-set dirt, stains, allergens and odors — including from pets or smoke — and restores your carpet’s texture and color.",
    icon: Brush,
    cta: ESTIMATE,
  },
  {
    title: "Gutter Cleaning",
    description:
      "Clears leaves, twigs and dirt from gutters and downspouts so water drains away from your home — helping prevent roof damage, ice dams and foundation problems.",
    icon: CloudRain,
    cta: ESTIMATE,
  },
  {
    title: "Window Washing",
    description: "Crystal-clear, streak-free windows inside and out, for more natural light and better curb appeal.",
    icon: AppWindow,
    cta: ESTIMATE,
  },
];

/** The four points the About page lists under "AHCA Certified Professionals". */
export const AHCA_TRAINING = [
  "The safest, most effective cleaning methods",
  "Indoor air quality and health",
  "The science and chemistry behind the work",
  "Working independently to solve any cleaning challenge",
] as const;

/** The three cards under "How We Make Sure Things Go Right". */
export const ABOUT_PRINCIPLES = [
  {
    title: "Training and education",
    body: "We teach the best methods and build systems that give every team member confidence in, and passion for, the work they do in every property.",
  },
  {
    title: "Quality, skilled individuals",
    body: "Trained, educated professionals with a strong foundation in chemistry and hands-on experience, who tackle any cleaning challenge with confidence and care.",
  },
  {
    title: "Top-notch customer service",
    body: "We identify your exact needs and develop a professional cleaning plan for your home or business.",
  },
] as const;
