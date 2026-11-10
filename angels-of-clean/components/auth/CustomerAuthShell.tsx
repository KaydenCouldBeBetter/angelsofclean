import Image from "next/image";
import Link from "next/link";

// Frame for every signed-out customer page (login, sign up, forgot and reset
// password; Figma Client Login 120:899 and Sign Up 120:942): the logo, then a
// single centred column that is the full screen on a phone and a card on a
// larger one. The marketing header is left out on purpose: these pages have one
// job, and every link out of them is in the page.
export default function CustomerAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white sm:bg-surface-tint">
      <div className="h-1 bg-primary" />
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-10 pt-6 sm:items-center">
        <div className="w-full max-w-[400px] sm:rounded-xl sm:border sm:border-line sm:bg-white sm:p-8 sm:shadow-sm">
          <Link href="/" className="mx-auto flex w-fit items-center">
            <Image
              src="/AngelsOfCleanLogoSVG.svg"
              alt="Angels of Clean, home"
              width={220}
              height={100}
              className="h-[72px] w-auto"
              priority
            />
          </Link>
          <div className="mt-4">{children}</div>
        </div>
      </main>
    </div>
  );
}
