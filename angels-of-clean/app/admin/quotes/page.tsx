import { getCommercialQuotes, type CommercialQuote } from "@/lib/supabase/queries";
import { formatNy } from "@/lib/datetime";
import LoadError from "../LoadError";

function QuoteCard({ quote }: { quote: CommercialQuote }) {
  const details = [
    { label: "Facility", value: quote.facility },
    { label: "Address", value: quote.address },
    { label: "Areas", value: quote.serviceAreas.join(", ") },
    { label: "Frequency", value: quote.frequency },
    { label: "Preference", value: quote.schedulePreference },
    { label: "Notes", value: quote.notes },
  ].filter((row) => row.value);

  return (
    <li className="bg-white border border-[#e2e8e6] rounded-xl overflow-hidden">
      <div className="px-6 py-5 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h3 className="font-semibold text-[17px] text-[#1c1c1e] leading-tight">
            {quote.businessName}
          </h3>
          <p className="text-[13px] text-[#1c1c1e] mt-1.5">
            {quote.contactName}
            {" · "}
            <a href={`mailto:${quote.email}`} className="text-primary font-medium hover:underline">
              {quote.email}
            </a>
            {" · "}
            <a href={`tel:${quote.phone}`} className="text-primary font-medium hover:underline">
              {quote.phone}
            </a>
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[13px] font-semibold text-[#1c1c1e]">{quote.quoteRef}</p>
          <p className="text-xs text-[#5c5c5e] mt-1">Received {quote.submittedAt}</p>
        </div>
      </div>

      <div className="h-px bg-[#e2e8e6] mx-6" />

      <dl className="px-6 py-4 flex flex-col gap-2.5">
        {details.map((row) => (
          <div key={row.label} className="flex">
            <dt className="w-[120px] flex-shrink-0 text-[13px] text-[#5c5c5e]">{row.label}</dt>
            <dd className="text-[13px] font-medium text-[#1c1c1e] whitespace-pre-line">{row.value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

export default async function AdminQuotesPage() {
  const quotes = await getCommercialQuotes();

  const displayDate = formatNy(new Date(), {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <>
      {/* Header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8 justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">
            Quotes
          </h1>
          <p className="text-xs text-[#5c5c5e]">Commercial quote requests</p>
        </div>
        <span className="text-sm text-[#5c5c5e]">{displayDate}</span>
      </header>

      {/* Content */}
      {!quotes.ok ? (
        <LoadError what="quote requests" />
      ) : (
        <div className="flex-1 overflow-auto bg-[#f7f9f8]">
          <div className="p-8">
            <h2 className="font-semibold text-[17px] text-[#1c1c1e] mb-6">
              {quotes.data.length === 1
                ? "1 request"
                : `${quotes.data.length} requests`}
              <span className="font-normal text-[13px] text-[#5c5c5e]"> · newest first</span>
            </h2>

            {quotes.data.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#5c5c5e]">
                No quote requests yet.
              </div>
            ) : (
              <ul className="flex flex-col gap-5">
                {quotes.data.map((quote) => (
                  <QuoteCard key={quote.id} quote={quote} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
