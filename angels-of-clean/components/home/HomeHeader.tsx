import Image from "next/image";
import Link from "next/link";
import { BUSINESS_PHONE } from "@/lib/constants";

export default function HomeHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 md:h-20 md:px-20">
      <Link href="/" className="flex items-center">
        <Image
          src="/AngelsOfCleanLogoSVG.svg"
          alt="Angels of Clean"
          width={220}
          height={100}
          className="h-12 w-auto md:h-16"
          priority
        />
      </Link>
      <a
        href={BUSINESS_PHONE.tel}
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <span className="sr-only">Call us: </span>
        {BUSINESS_PHONE.display}
      </a>
    </header>
  );
}
