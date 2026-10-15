// Business details and policies used by the Privacy Policy (/privacy) and
// Terms of Service (/terms). The owner fills these in (backlog B6, decision 9).
//
// Every `null` renders as a visible "to be provided" placeholder, and both pages
// show a draft banner and ask search engines not to index them until every
// value below is set AND `reviewed` is true. Set `reviewed` only after the owner
// (ideally with legal advice) has read both pages in full; the surrounding text
// is a starting template, not legal advice.

export interface LegalInfo {
  /** Legal name of the business, e.g. "Angels of Clean LLC". */
  legalName: string | null;
  /** Mailing address for privacy and legal requests. */
  mailingAddress: string | null;
  /** Email address customers can write to about their data or these terms. */
  contactEmail: string | null;
  /** Business phone number (one real number; see backlog B32). */
  contactPhone: string | null;
  /** Date both documents take effect, in words, e.g. "November 1, 2026". */
  effectiveDate: string | null;
  /** How long booking and quote records are kept, e.g. "three years after your last cleaning". */
  recordRetention: string | null;
  /** Cancellation and rescheduling rules, including any notice period or fee. */
  cancellationPolicy: string | null;
  /** When and how customers pay, and which payment methods are accepted. */
  paymentTerms: string | null;
  /** How reports of damage or a missed spot are handled, and any limits. */
  damagePolicy: string | null;
  /** True once the owner has reviewed both pages in full. */
  reviewed: boolean;
}

export const LEGAL_INFO: LegalInfo = {
  legalName: null,
  mailingAddress: null,
  contactEmail: null,
  contactPhone: null,
  effectiveDate: null,
  recordRetention: null,
  cancellationPolicy: null,
  paymentTerms: null,
  damagePolicy: null,
  reviewed: false,
};

/** Human-readable descriptions of each owner-supplied value, used by placeholders. */
export const LEGAL_FIELD_LABELS: Record<Exclude<keyof LegalInfo, "reviewed">, string> = {
  legalName: "legal business name",
  mailingAddress: "mailing address",
  contactEmail: "contact email",
  contactPhone: "business phone number",
  effectiveDate: "effective date",
  recordRetention: "how long records are kept",
  cancellationPolicy: "cancellation and rescheduling policy",
  paymentTerms: "payment terms",
  damagePolicy: "damage and re-clean policy",
};

/** The owner-supplied values that are still missing. */
export function missingLegalFields(info: LegalInfo = LEGAL_INFO): string[] {
  return (Object.keys(LEGAL_FIELD_LABELS) as (keyof typeof LEGAL_FIELD_LABELS)[])
    .filter((key) => {
      const value = info[key];
      return value === null || value.trim() === "";
    })
    .map((key) => LEGAL_FIELD_LABELS[key]);
}

/** True until every value is filled in and the owner has reviewed the text. */
export function isLegalDraft(info: LegalInfo = LEGAL_INFO): boolean {
  return !info.reviewed || missingLegalFields(info).length > 0;
}
