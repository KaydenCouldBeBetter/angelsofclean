import Image from "next/image";
import Link from "next/link";

interface DesktopNavbarProps {
  tagline?: string;
}

export default function DesktopNavbar({ tagline }: DesktopNavbarProps) {
  return (
    <header className="hidden lg:flex items-center h-20 px-20 border-b border-zinc-200 bg-white">
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
        <span className="ml-2 text-xs text-zinc-400 self-end mb-1">{tagline}</span>
      )}

      <div className="ml-auto flex items-center gap-8">
        <span className="text-sm text-zinc-700">(315) 516-1266</span>
        <button className="h-9 px-5 rounded-md border border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
          Log In
        </button>
      </div>
    </header>
  );
}
