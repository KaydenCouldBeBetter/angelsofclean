import Image from "next/image";
import Link from "next/link";
import { BUSINESS_PHONE } from "@/lib/constants";

// The commercial flow's only difference from the residential navbar.
export const COMMERCIAL_NAV_TAGLINE = "Commercial Services";

interface DesktopNavbarProps {
  tagline?: string;
}

export default function DesktopNavbar({ tagline }: DesktopNavbarProps) {
  return (
    <header className="hidden md:flex items-center h-20 px-20 border-b border-zinc-200 bg-white">
      <Link href="/" className="flex items-center">
        <Image
          src="/AngelsOfCleanLogoSVG.svg"
          alt="Angels of Clean"
          width={220}
          height={100}
          className="h-18 w-auto"
          priority
        />
      </Link>

      {tagline && (
        <span className="ml-2 text-xs text-zinc-500 self-end mb-1">{tagline}</span>
      )}

      <div className="ml-auto flex items-center gap-8">
        <a href={BUSINESS_PHONE.tel} className="text-sm text-zinc-700">
          {BUSINESS_PHONE.display}
        </a>
        <button className="h-9 px-5 rounded-md border border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
          Log In
        </button>
      </div>
    </header>
  );
}
