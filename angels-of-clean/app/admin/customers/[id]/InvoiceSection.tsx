"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { invoiceDisplayStatus, prepareInvoices } from "@/lib/customer-billing";
import { INVOICE_DESCRIPTION_MAX, PAYMENT_NOTE_MAX } from "@/lib/admin-customers";
import type { AdminQuoteRef, AdminVisitRef } from "@/lib/admin-customer-types";
import { INVOICE_STATUS } from "@/lib/customer-status";
import type { InvoiceDetail } from "@/lib/customer-types";
import { formatCents } from "@/lib/money";
import { createInvoice, markInvoicePaid, reopenInvoice, voidInvoice } from "../actions";
import { DANGER_BUTTON, Field, FormError, INPUT_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from "./form-ui";

export default function InvoiceSection({
  accountId,
  invoices,
  visits,
  quotes,
  today,
  defaultDueOn,
}: {
  accountId: string;
  invoices: InvoiceDetail[];
  visits: AdminVisitRef[];
  quotes: AdminQuoteRef[];
  /** The New York date, "YYYY-MM-DD", worked out on the server. */
  today: string;
  defaultDueOn: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [issuedOn, setIssuedOn] = useState(today);
  const [dueOn, setDueOn] = useState(defaultDueOn);
  // "" for none, otherwise "booking:<id>" or "quote:<id>".
  const [subject, setSubject] = useState("");
  const [paying, setPaying] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [confirmingVoid, setConfirmingVoid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { balanceCents, open } = prepareInvoices(invoices, today);

  function run(action: () => Promise<{ success: true } | { success: false; error: string }>, then?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        then?.();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const [kind, id] = subject.split(":");
    run(
      () =>
        createInvoice(accountId, {
          amount,
          description,
          issuedOn,
          dueOn,
          bookingId: kind === "booking" ? id : null,
          quoteId: kind === "quote" ? id : null,
        }),
      () => {
        setAdding(false);
        setAmount("");
        setDescription("");
        setSubject("");
        setIssuedOn(today);
        setDueOn(defaultDueOn);
      },
    );
  }

  function startPaying(id: string) {
    setPaying(id);
    setPaidOn(today);
    setNote("");
    setError(null);
  }

  return (
    <section aria-labelledby="invoices" className="bg-white border border-[#e2e8e6] rounded-xl">
      <div className="px-6 py-4 flex items-center justify-between gap-4 border-b border-[#e2e8e6]">
        <div>
          <h2 id="invoices" className="font-semibold text-[17px] text-[#1c1c1e]">
            Invoices
          </h2>
          <p className="text-xs text-[#5c5c5e] mt-0.5">
            {open.length === 0
              ? "Nothing owed."
              : `${formatCents(balanceCents)} owed on ${open.length} open ${open.length === 1 ? "invoice" : "invoices"}. Nothing is charged online.`}
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={SECONDARY_BUTTON}>
            Add invoice
          </button>
        )}
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">
        {error && <FormError>{error}</FormError>}

        {invoices.length === 0 && !adding && <p className="text-[13px] text-[#5c5c5e]">No invoices yet.</p>}

        {invoices.length > 0 && (
          <ul className="flex flex-col gap-3">
            {invoices.map((invoice) => {
              const display = invoiceDisplayStatus(invoice, today);
              const chip = INVOICE_STATUS[display];
              return (
                <li key={invoice.id} className="rounded-lg border border-[#e2e8e6] p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#1c1c1e]">
                        {invoice.number} · {invoice.amountLabel}
                      </p>
                      <p className="text-[13px] text-[#1c1c1e]">{invoice.description}</p>
                      <p className="text-xs text-[#5c5c5e] mt-0.5">
                        Issued {invoice.issuedLabel}
                        {invoice.status === "paid"
                          ? ` · Paid ${invoice.paidLabel ?? ""}`
                          : invoice.status === "open"
                            ? ` · Due ${invoice.dueLabel}`
                            : ""}
                        {invoice.visit && ` · ${invoice.visit.label}`}
                        {invoice.quoteRef && ` · ${invoice.quoteRef}`}
                      </p>
                      {invoice.paymentNote && (
                        <p className="text-xs text-[#5c5c5e]">Payment note: {invoice.paymentNote}</p>
                      )}
                    </div>
                    <span
                      className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${chip.chipBg} ${chip.chipText}`}
                    >
                      {display === "overdue" && <CircleAlert aria-hidden="true" className="size-3.5" />}
                      {chip.label}
                    </span>
                  </div>

                  {invoice.status === "open" && paying !== invoice.id && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startPaying(invoice.id)} className={SECONDARY_BUTTON}>
                        Mark paid<span className="sr-only"> {invoice.number}</span>
                      </button>
                      {confirmingVoid === invoice.id ? (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => run(() => voidInvoice(invoice.id), () => setConfirmingVoid(null))}
                            className={DANGER_BUTTON}
                          >
                            Yes, cancel this invoice
                          </button>
                          <button type="button" onClick={() => setConfirmingVoid(null)} className={SECONDARY_BUTTON}>
                            Keep it
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmingVoid(invoice.id)} className={DANGER_BUTTON}>
                          Cancel invoice<span className="sr-only"> {invoice.number}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {invoice.status === "open" && paying === invoice.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(() => markInvoicePaid(invoice.id, { paidOn, note }), () => setPaying(null));
                      }}
                      className="rounded-lg bg-[#f7f9f8] p-3 flex flex-col gap-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <Field id={`paid-on-${invoice.id}`} label="Paid on">
                          <input id={`paid-on-${invoice.id}`} type="date" required max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={INPUT_CLASS} />
                        </Field>
                        <Field id={`paid-note-${invoice.id}`} label="How (optional)">
                          <input id={`paid-note-${invoice.id}`} maxLength={PAYMENT_NOTE_MAX} placeholder="Check #1042" value={note} onChange={(e) => setNote(e.target.value)} className={INPUT_CLASS} />
                        </Field>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
                          {isPending ? "Saving…" : "Save payment"}
                        </button>
                        <button type="button" onClick={() => setPaying(null)} className={SECONDARY_BUTTON}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {invoice.status === "paid" && (
                    <div>
                      <button type="button" disabled={isPending} onClick={() => run(() => reopenInvoice(invoice.id))} className={SECONDARY_BUTTON}>
                        Undo payment<span className="sr-only"> {invoice.number}</span>
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {adding && (
          <form onSubmit={handleCreate} className="rounded-lg border border-[#e2e8e6] bg-[#f7f9f8] p-4 flex flex-col gap-4">
            <h3 className="font-semibold text-[15px] text-[#1c1c1e]">New invoice</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field id="invoice-amount" label="Amount (USD)" hint="Dollars, like 125.00.">
                <input id="invoice-amount" required inputMode="decimal" autoComplete="off" placeholder="125.00" value={amount} onChange={(e) => setAmount(e.target.value)} className={INPUT_CLASS} />
              </Field>
              <Field id="invoice-for" label="For (optional)" hint="Only this account's visits and quotes are listed.">
                <select id="invoice-for" value={subject} onChange={(e) => setSubject(e.target.value)} className={INPUT_CLASS}>
                  <option value="">A general charge</option>
                  {visits.length > 0 && (
                    <optgroup label="Visits">
                      {visits.map((visit) => (
                        <option key={visit.id} value={`booking:${visit.id}`}>{visit.ref} · {visit.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {quotes.length > 0 && (
                    <optgroup label="Quote requests">
                      {quotes.map((quote) => (
                        <option key={quote.id} value={`quote:${quote.id}`}>{quote.ref} · {quote.businessName}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </Field>
            </div>
            <Field id="invoice-description" label="Description" hint="The customer sees this.">
              <input id="invoice-description" required maxLength={INVOICE_DESCRIPTION_MAX} value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT_CLASS} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="invoice-issued" label="Issued on">
                <input id="invoice-issued" type="date" required value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className={INPUT_CLASS} />
              </Field>
              <Field id="invoice-due" label="Due on">
                <input id="invoice-due" type="date" required min={issuedOn} value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={INPUT_CLASS} />
              </Field>
            </div>
            <p className="text-xs text-[#5c5c5e]">
              An issued invoice&apos;s amount can&apos;t be edited. To fix a mistake, cancel it and add a new one.
            </p>
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
                {isPending ? "Saving…" : "Save invoice"}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError(null); }} className={SECONDARY_BUTTON}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
