import type { CustomerQuote } from "@/lib/customer-types";

// Quote requests the account has sent. There is no status to show (staff answer
// by phone or email), so each card says what was asked for and when.
export default function QuoteList({ quotes }: { quotes: CustomerQuote[] }) {
  return (
    <ul aria-label="Quote requests" className="flex flex-col gap-3">
      {quotes.map((quote) => (
        <li key={quote.id} className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-ink">
              {quote.facilityLabel} · {quote.frequencyLabel}
            </p>
            <p className="flex-shrink-0 text-sm font-medium text-ink-muted">{quote.ref}</p>
          </div>
          <p className="text-sm text-ink-muted">
            {quote.sqftLabel} · requested {quote.submittedLabel}
          </p>
          <p className="truncate text-sm text-ink-muted">
            {quote.address}, {quote.cityLine}
          </p>
        </li>
      ))}
    </ul>
  );
}
