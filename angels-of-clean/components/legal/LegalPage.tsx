import Link from "next/link";
import {
  LEGAL_FIELD_LABELS,
  LEGAL_INFO,
  isLegalDraft,
  missingLegalFields,
  type LegalInfo,
} from "@/lib/legal";

type LegalField = keyof typeof LEGAL_FIELD_LABELS;

// Renders an owner-supplied value, or a visible placeholder while it is missing.
export function LegalValue({
  field,
  info = LEGAL_INFO,
}: {
  field: LegalField;
  info?: LegalInfo;
}) {
  const value = info[field];
  if (value === null || value.trim() === "") {
    return (
      <span className="rounded bg-amber-50 px-1 font-medium text-amber-900 ring-1 ring-amber-300">
        [To be provided: {LEGAL_FIELD_LABELS[field]}]
      </span>
    );
  }
  if (field === "contactEmail") {
    return (
      <a href={`mailto:${value}`} className="text-[#1a6b5a] underline underline-offset-2">
        {value}
      </a>
    );
  }
  if (field === "contactPhone") {
    return (
      <a href={`tel:${value.replace(/[^\d+]/g, "")}`} className="text-[#1a6b5a] underline underline-offset-2">
        {value}
      </a>
    );
  }
  return <>{value}</>;
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}

export function ContactLines({ info = LEGAL_INFO }: { info?: LegalInfo }) {
  return (
    <ul className="flex flex-col gap-1">
      <li>Email: <LegalValue field="contactEmail" info={info} /></li>
      <li>Phone: <LegalValue field="contactPhone" info={info} /></li>
      <li>Mail: <LegalValue field="mailingAddress" info={info} /></li>
    </ul>
  );
}

// Shared shell for the Privacy Policy and Terms of Service pages.
export default function LegalPage({
  title,
  info = LEGAL_INFO,
  children,
}: {
  title: string;
  info?: LegalInfo;
  children: React.ReactNode;
}) {
  const draft = isLegalDraft(info);
  const missing = missingLegalFields(info);

  return (
    <div className="flex-1 bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-base font-bold text-zinc-900">
            Angels of Clean
          </Link>
          <nav aria-label="Legal" className="flex gap-4 text-sm">
            <Link href="/privacy" className="text-[#1a6b5a] underline-offset-2 hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="text-[#1a6b5a] underline-offset-2 hover:underline">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 text-[15px] leading-relaxed text-zinc-700">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-zinc-900">{title}</h1>
          <p className="text-sm text-zinc-600">
            Effective date: <LegalValue field="effectiveDate" info={info} />
          </p>
        </div>

        {draft && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Draft — not yet in effect</p>
            <p className="mt-1">
              This page is still being finalized.
              {missing.length > 0 && <> Still to be provided: {missing.join(", ")}.</>}
            </p>
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
