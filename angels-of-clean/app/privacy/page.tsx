import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, {
  ContactLines,
  LegalList,
  LegalSection,
  LegalValue,
} from "@/components/legal/LegalPage";
import { isLegalDraft } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Angels of Clean collects when you book, how it is used, and your choices.",
  // Keep the draft out of search results until the owner has finished it.
  robots: isLegalDraft() ? { index: false, follow: false } : undefined,
};

// Describes what the app actually does — keep it in step with the code when
// data collection changes (booking/quote fields, storage, rate limiting, hosting).
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what information <LegalValue field="legalName" /> (&ldquo;Angels of
        Clean&rdquo;, &ldquo;we&rdquo;) collects when you book a cleaning or request a commercial
        quote on this website, how we use it, and the choices you have.
      </p>

      <LegalSection title="Information you give us">
        <p>When you book a residential cleaning, we collect:</p>
        <LegalList>
          <li>the service you choose and how often you want it</li>
          <li>the address, city and ZIP code of the home</li>
          <li>the number of bedrooms and bathrooms</li>
          <li>any notes you add</li>
          <li>
            any entry instructions you add, such as a door or gate code or a note about pets. We
            store these separately from the rest of your booking: only our office staff with
            administrator access can see them, on that booking&apos;s own page. They aren&apos;t
            shown in our booking lists or calendar, written to our activity records or server
            logs, or included in emails. Please include only what our team needs to get in.
          </li>
          <li>the date and time window you choose</li>
          <li>your name, email address and phone number</li>
        </LegalList>
        <p>When you request a commercial quote, we collect:</p>
        <LegalList>
          <li>your business name, and your name, email address and phone number</li>
          <li>the facility type, approximate size, address, number of floors and areas to clean</li>
          <li>how often you need service, your preferred schedule and any notes you add</li>
        </LegalList>
        <p>We don&apos;t ask for payment details on this website.</p>
      </LegalSection>

      <LegalSection title="Information collected automatically">
        <LegalList>
          <li>
            To stop automated abuse of our booking and quote forms, we use your IP address to limit
            how many requests can be sent from one connection. We store only a scrambled one-way
            code made from it, never the address itself, and delete it automatically, normally
            within a day.
          </li>
          <li>
            The company that hosts this website may keep standard server logs, which can include
            your IP address, browser type and the pages you requested, for security and
            troubleshooting.
          </li>
          <li>
            We don&apos;t use advertising or analytics cookies, and we don&apos;t track you across
            other websites.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Information stored in your browser">
        <p>
          While you fill in a booking or quote request, your answers are kept in your
          browser&apos;s session storage so you can go back and change them. They are cleared once
          your request is sent and confirmed, and your browser deletes them when you close the
          tab. You don&apos;t need an account to book.
        </p>
        <p>
          Our staff use a sign-in cookie when they sign in to manage bookings. It is needed to keep
          them signed in and isn&apos;t used for anything else.
        </p>
      </LegalSection>

      <LegalSection title="How we use your information">
        <LegalList>
          <li>to review, schedule and confirm your cleaning, or prepare your quote</li>
          <li>to contact you about your booking or request</li>
          <li>to carry out the cleaning, including getting into the property as you describe</li>
          <li>to keep this website secure and prevent abuse</li>
          <li>to keep business records and meet our legal obligations</li>
        </LegalList>
        <p>
          We don&apos;t sell your personal information, and we don&apos;t use it for advertising.
        </p>
      </LegalSection>

      <LegalSection title="Who can see your information">
        <LegalList>
          <li>
            Our staff who schedule and carry out your cleaning. Viewing booking and quote records
            requires a staff sign-in. Entry instructions are seen only by our office staff with
            administrator access.
          </li>
          <li>
            Service providers that run this website for us: Supabase, which stores booking and
            quote records, and our website hosting provider. They handle your information only to
            provide their services to us.
          </li>
          <li>
            Google, only if you choose &ldquo;Add to Google Calendar&rdquo; after booking: that
            sends your cleaning&rsquo;s date, time and address to Google. The Apple Calendar file
            is saved on your device and isn&rsquo;t sent anywhere.
          </li>
          <li>
            Others, when the law requires it or when needed to protect the rights, property or
            safety of our customers, staff or others.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep booking and quote records for <LegalValue field="recordRetention" />, then
          delete them, unless the law requires us to keep them longer. The scrambled code made from
          your IP address is deleted automatically, normally within a day.
        </p>
      </LegalSection>

      <LegalSection title="Keeping it secure">
        <p>
          Information is sent to us over an encrypted connection, and only signed-in staff with
          administrator access can view booking and quote records. No way of storing or sending
          information is completely secure. If a breach affects your information, we will tell you
          as New York law requires.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can ask us to show you the information we hold about you, correct it, or delete it.
          Contact us using the details below. We may need to confirm who you are first, and we may
          keep some records where the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          This website is for adults arranging cleaning services. We don&apos;t knowingly collect
          information from children under 13.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If we change this policy, we&apos;ll post the new version here and update the effective
          date. Our{" "}
          <Link href="/terms" className="text-primary underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          also apply when you book.
        </p>
      </LegalSection>

      <LegalSection title="Contact us">
        <p>Questions or requests about your information:</p>
        <ContactLines />
      </LegalSection>
    </LegalPage>
  );
}
