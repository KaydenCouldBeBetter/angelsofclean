import Link from "next/link";
import { BUSINESS_PHONE } from "@/lib/constants";
import { pauseText, type BookingRules } from "@/lib/booking-rules";

// Shown in place of the booking steps while an admin has paused online booking.
// It is the page's main heading, so the page still has an h1, and it gives the
// phone number as a link: this is a way to book, not a dead end.
export default function BookingPausedNotice({ rules }: { rules: Pick<BookingRules, "pauseMessage"> }) {
  return (
    <section aria-labelledby="paused-heading" className="flex flex-col gap-4 px-4 py-10 lg:px-0">
      <h1 id="paused-heading" className="text-2xl font-bold leading-tight lg:text-3xl">
        Online booking is paused
      </h1>
      <p className="text-base text-zinc-700">{pauseText(rules)}</p>
      <p className="text-base text-zinc-700">
        Call us at{" "}
        <a href={BUSINESS_PHONE.tel} className="font-semibold text-primary underline">
          {BUSINESS_PHONE.display}
        </a>
        .
      </p>
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        &larr; Back to the home page
      </Link>
    </section>
  );
}
