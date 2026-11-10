import type { BookingStatus } from "@/lib/supabase/types";

// How a customer sees a booking's status. The office's own words ("Pending",
// "Active") mean little to a customer, and a request must never read as booked
// before staff confirm it (the confirmation page says "Booking request
// received"), so these are separate from app/admin/status-config.ts. The colours
// are the same pairs the admin chips use, which __tests__/status-contrast.test.ts
// already holds to WCAG AA; customer-status.test.ts checks these against the
// same bar and against those pairs. The label is always shown with the colour.
export const CUSTOMER_STATUS: Record<
  BookingStatus,
  { label: string; description: string; chipBg: string; chipText: string }
> = {
  pending: {
    label: "Awaiting confirmation",
    description: "We've received your request. We'll confirm the visit and your price.",
    chipBg: "bg-[#f7f9f8]",
    chipText: "text-[#5c5c5e]",
  },
  confirmed: {
    label: "Confirmed",
    description: "Your visit is confirmed. We'll see you then.",
    chipBg: "bg-[#eaeefc]",
    chipText: "text-[#1d4ed8]",
  },
  active: {
    label: "In progress",
    description: "Your cleaning is under way.",
    chipBg: "bg-[#fef2e8]",
    chipText: "text-[#b45309]",
  },
  done: {
    label: "Completed",
    description: "This visit is complete.",
    chipBg: "bg-[#e1f2e7]",
    chipText: "text-[#166534]",
  },
  cancelled: {
    label: "Cancelled",
    description: "This visit was cancelled. Call us if you'd like to rebook.",
    chipBg: "bg-[#feefee]",
    chipText: "text-[#c0392b]",
  },
};

// An invoice's chip. Overdue is open past its due day; the words carry it, and the
// icon on the page adds a second cue. Same colour pairs as the chips above.
export const INVOICE_STATUS: Record<
  "open" | "overdue" | "paid" | "void",
  { label: string; chipBg: string; chipText: string }
> = {
  open: { label: "Open", chipBg: "bg-[#eaeefc]", chipText: "text-[#1d4ed8]" },
  overdue: { label: "Overdue", chipBg: "bg-[#feefee]", chipText: "text-[#c0392b]" },
  paid: { label: "Paid", chipBg: "bg-[#e1f2e7]", chipText: "text-[#166534]" },
  void: { label: "Cancelled", chipBg: "bg-[#f7f9f8]", chipText: "text-[#5c5c5e]" },
};

// A service plan's chip, same pairs as the booking chips above.
export const PLAN_STATUS_CHIP = {
  active: { chipBg: "bg-[#e1f2e7]", chipText: "text-[#166534]" },
  paused: { chipBg: "bg-[#fef2e8]", chipText: "text-[#b45309]" },
} as const;

export const PLAN_STATUS_LABEL = {
  active: "Active",
  paused: "Paused",
  ended: "Ended",
} as const;
