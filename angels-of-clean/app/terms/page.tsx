import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, {
  ContactLines,
  LegalSection,
  LegalValue,
} from "@/components/legal/LegalPage";
import { isLegalDraft } from "@/lib/legal";
import { PRICE_NOTE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you book a cleaning or request a quote from Angels of Clean.",
  // Keep the draft out of search results until the owner has finished it.
  robots: isLegalDraft() ? { index: false, follow: false } : undefined,
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms apply when you use this website to book a residential cleaning or request a
        commercial quote from <LegalValue field="legalName" /> (&ldquo;Angels of Clean&rdquo;,
        &ldquo;we&rdquo;). By sending a booking or quote request, you agree to them.
      </p>

      <LegalSection title="Booking requests">
        <p>
          Sending a booking gives us a request, not a confirmed appointment. Your cleaning is
          booked once we confirm it with you. We may decline a request or ask to move it, for
          example if the time is no longer available.
        </p>
        <p>
          You must be at least 18 and allowed to arrange cleaning at the address you give us.
        </p>
      </LegalSection>

      <LegalSection title="Commercial quote requests">
        <p>
          A quote request doesn&apos;t commit you or us to anything. We&apos;ll reply with a quote,
          and any commercial service is covered by the agreement we make with you at that point.
        </p>
      </LegalSection>

      <LegalSection title="Service area">
        <p>
          We serve selected ZIP codes in Central New York. If your address is outside our area,
          this website tells you before you book.
        </p>
      </LegalSection>

      <LegalSection title="Prices and payment">
        <p>
          {PRICE_NOTE}
        </p>
        <p><LegalValue field="paymentTerms" /></p>
      </LegalSection>

      <LegalSection title="Cancelling or rescheduling">
        <p><LegalValue field="cancellationPolicy" /></p>
      </LegalSection>

      <LegalSection title="Access to your property">
        <p>
          Please give us accurate details about the property and how to get in. If we can&apos;t
          get in or can&apos;t safely complete the cleaning, we may need to reschedule.
        </p>
      </LegalSection>

      <LegalSection title="Damage and re-cleans">
        <p><LegalValue field="damagePolicy" /></p>
      </LegalSection>

      <LegalSection title="Using this website">
        <p>
          Please don&apos;t misuse this website, for example by sending false requests or trying to
          interfere with how it works. We may limit or block requests that look automated or
          abusive.
        </p>
      </LegalSection>

      <LegalSection title="Your information">
        <p>
          Our{" "}
          <Link href="/privacy" className="text-primary underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          explains what we collect when you book and how we use it.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>These terms are governed by the laws of the State of New York.</p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          If we change these terms, we&apos;ll post the new version here and update the effective
          date. The terms in effect when you send a request apply to that request.
        </p>
      </LegalSection>

      <LegalSection title="Contact us">
        <ContactLines />
      </LegalSection>
    </LegalPage>
  );
}
