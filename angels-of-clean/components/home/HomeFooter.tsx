import Link from "next/link";
import { BUSINESS_PHONE } from "@/lib/constants";

export default function HomeFooter() {
  const linkClass = "inline-flex min-h-11 items-center underline underline-offset-4";
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white px-4 py-8 md:px-20">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 text-sm text-zinc-700 md:flex-row md:items-center md:justify-between">
        <p className="font-semibold text-zinc-900">Angels of Clean · Syracuse, NY</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
          <a href={BUSINESS_PHONE.tel} className={linkClass}>
            {BUSINESS_PHONE.display}
          </a>
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          <Link href="/terms" className={linkClass}>
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
