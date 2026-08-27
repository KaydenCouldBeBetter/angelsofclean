"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminCreateBooking } from "@/app/actions/submitBooking";

const SERVICES = [
  { value: "standard", label: "Standard Clean" },
  { value: "deep", label: "Deep Clean" },
  { value: "moveinout", label: "Move-In / Move-Out" },
] as const;

const FREQUENCIES = [
  { value: "one-time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

const TIME_SLOTS = [
  { value: "morning", label: "Morning (9am–11am)" },
  { value: "afternoon", label: "Afternoon (1pm–3pm)" },
] as const;

interface NewBookingModalProps {
  open: boolean;
  onClose: () => void;
  adminEmail: string;
}

export default function NewBookingModal({ open, onClose, adminEmail }: NewBookingModalProps) {
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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

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
        adminEmail,
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-[600px] max-h-[84vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8e6]">
          <h2 className="text-lg font-semibold text-[#1c1c1e]">New Booking</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#f0f0f0] text-[#5c5c5e] transition-colors text-lg"
          >
            &#10005;
          </button>
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
                  <Input id="nb-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="h-10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="nb-email" className="text-[13px] text-[#1c1c1e] mb-1">Email</Label>
                    <Input id="nb-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="h-10" />
                  </div>
                  <div>
                    <Label htmlFor="nb-phone" className="text-[13px] text-[#1c1c1e] mb-1">Phone</Label>
                    <Input id="nb-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(315) 555-0100" className="h-10" />
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
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                  <Input id="nb-address" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" className="h-10" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="nb-city" className="text-[13px] text-[#1c1c1e] mb-1">City</Label>
                    <Input id="nb-city" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Syracuse" className="h-10" />
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
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
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
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            className="h-9 px-5 text-sm bg-[#1a6b5a] hover:bg-[#155a4b]"
          >
            {isPending ? "Creating..." : "Create Booking"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small client wrapper — drop into any server component page. */
export function NewBookingButton({ adminEmail }: { adminEmail: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-[#1a6b5a] hover:bg-[#155a4b] text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors"
      >
        + New Booking
      </button>
      <NewBookingModal open={open} onClose={() => setOpen(false)} adminEmail={adminEmail} />
    </>
  );
}
