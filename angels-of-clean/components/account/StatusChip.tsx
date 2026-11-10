import { CUSTOMER_STATUS } from "@/lib/customer-status";
import type { BookingStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

// The status as words in a tinted pill. The wording is what carries the
// meaning; the colour only backs it up.
export default function StatusChip({ status, className }: { status: BookingStatus; className?: string }) {
  const { label, chipBg, chipText } = CUSTOMER_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        chipBg,
        chipText,
        className,
      )}
    >
      {label}
    </span>
  );
}
