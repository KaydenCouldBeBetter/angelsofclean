"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminCreateBooking } from "@/app/actions/submitBooking";
import {
  BATHROOM_OPTIONS,
  FIELD_MAX_LENGTHS,
  FREQUENCY_OPTIONS,
  SERVICE_LABELS,
  TIME_LABELS,
} from "@/lib/constants";

// Same options, labels and order (least to most frequent) as the customer flows.
const SERVICES = Object.entries(SERVICE_LABELS).map(([value, label]) => ({ value, label }));

const FREQUENCIES = FREQUENCY_OPTIONS.map(({ id, label }) => ({ value: id, label }));

const TIME_SLOTS = Object.entries(TIME_LABELS).map(([value, label]) => ({ value, label }));

interface NewBookingModalProps {
  open: boolean;
  onClose: () => void;
}

export default function NewBookingModal({ open, onClose }: NewBookingModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("standard");
  const [frequency, setFrequency] = useState("one-time");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("morning");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setName(""); setEmail(""); setPhone("");
    setService("standard"); setFrequency("one-time");
    setAddress(""); setCity(""); setZip("");
    setBedrooms(1); setBathrooms(1);
    setDate(""); setTimeSlot("morning"); setNotes("");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await adminCreateBooking(
        { service, frequency, address, city, zip, bedrooms, bathrooms, notes, date, timeSlot, name, email, phone },
      );

      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      resetForm();
      onClose();
      router.refresh();
    });
  }

  // Base UI's modal Dialog gives the popup role="dialog", names it by its
  // title, moves focus in on open, keeps Tab inside, closes on Escape or an
  // outside press, locks page scroll, and returns focus to whatever opened it.
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />

        <Dialog.Popup
          aria-modal="true"
          className="fixed left-1/2 top-[10vh] z-50 -translate-x-1/2 bg-white rounded-xl shadow-xl w-[600px] max-h-[84vh] flex flex-col"
        >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8e6]">
          <Dialog.Title className="text-lg font-semibold text-[#1c1c1e]">New Booking</Dialog.Title>
          <Dialog.Close
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#f0f0f0] text-[#5c5c5e] transition-colors text-lg"
          >
            <span aria-hidden="true">&#10005;</span>
          </Dialog.Close>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            {/* ── Client Info ── */}
            <div>
              <p className="text-xs font-semibold text-[#5c5c5e] uppercase tracking-wide mb-3">Client Information</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="nb-name" className="text-[13px] text-[#1c1c1e] mb-1">Full Name</Label>
                  <Input id="nb-name" required maxLength={FIELD_MAX_LENGTHS.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="h-10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="nb-email" className="text-[13px] text-[#1c1c1e] mb-1">Email</Label>
                    <Input id="nb-email" type="email" required maxLength={FIELD_MAX_LENGTHS.email} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="h-10" />
                  </div>
                  <div>
                    <Label htmlFor="nb-phone" className="text-[13px] text-[#1c1c1e] mb-1">Phone</Label>
                    <Input id="nb-phone" type="tel" required maxLength={FIELD_MAX_LENGTHS.phone} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(315) 555-0123" className="h-10" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Service Details ── */}
            <div>
              <p className="text-xs font-semibold text-[#5c5c5e] uppercase tracking-wide mb-3">Service Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nb-service" className="text-[13px] text-[#1c1c1e] mb-1">Service Type</Label>
                  <select
                    id="nb-service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    {SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="nb-frequency" className="text-[13px] text-[#1c1c1e] mb-1">Frequency</Label>
                  <select
                    id="nb-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Address ── */}
            <div>
              <p className="text-xs font-semibold text-[#5c5c5e] uppercase tracking-wide mb-3">Address</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="nb-address" className="text-[13px] text-[#1c1c1e] mb-1">Street Address</Label>
                  <Input id="nb-address" required maxLength={FIELD_MAX_LENGTHS.address} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className="h-10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="nb-city" className="text-[13px] text-[#1c1c1e] mb-1">City</Label>
                    <Input id="nb-city" required maxLength={FIELD_MAX_LENGTHS.city} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Syracuse" className="h-10" />
                  </div>
                  <div>
                    <Label htmlFor="nb-zip" className="text-[13px] text-[#1c1c1e] mb-1">ZIP Code</Label>
                    <Input id="nb-zip" required value={zip} onChange={(e) => setZip(e.target.value)} placeholder="13201" maxLength={5} className="h-10" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Property ── */}
            <div>
              <p className="text-xs font-semibold text-[#5c5c5e] uppercase tracking-wide mb-3">Property</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nb-bed" className="text-[13px] text-[#1c1c1e] mb-1">Bedrooms</Label>
                  <select
                    id="nb-bed"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(Number(e.target.value))}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="nb-bath" className="text-[13px] text-[#1c1c1e] mb-1">Bathrooms</Label>
                  <select
                    id="nb-bath"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    {BATHROOM_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Schedule ── */}
            <div>
              <p className="text-xs font-semibold text-[#5c5c5e] uppercase tracking-wide mb-3">Schedule</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nb-date" className="text-[13px] text-[#1c1c1e] mb-1">Date</Label>
                  <Input id="nb-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
                </div>
                <div>
                  <Label htmlFor="nb-time" className="text-[13px] text-[#1c1c1e] mb-1">Time Slot</Label>
                  <select
                    id="nb-time"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    {TIME_SLOTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Notes ── */}
            <div>
              <Label htmlFor="nb-notes" className="text-[13px] text-[#1c1c1e] mb-1">Notes (optional)</Label>
              <Textarea
                id="nb-notes"
                maxLength={FIELD_MAX_LENGTHS.notes}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions..."
                rows={3}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e2e8e6]">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="h-9 px-5 text-sm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            onClick={handleSubmit}
            className="h-9 px-5 text-sm"
          >
            {isPending ? "Creating..." : "Create Booking"}
          </Button>
        </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Small client wrapper — drop into any server component page. */
export function NewBookingButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-primary hover:bg-primary-pressed text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors"
      >
        + New Booking
      </button>
      <NewBookingModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
