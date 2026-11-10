import { CircleAlert } from "lucide-react";
import { INVOICE_STATUS } from "@/lib/customer-status";
import type { InvoiceDisplay } from "@/lib/customer-types";
import { cn } from "@/lib/utils";

// An invoice's status as words in a tinted pill. Overdue also carries an alert
// icon, so it never depends on colour alone.
export default function InvoiceChip({ display, className }: { display: InvoiceDisplay; className?: string }) {
  const { label, chipBg, chipText } = INVOICE_STATUS[display];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        chipBg,
        chipText,
        className,
      )}
    >
      {display === "overdue" && <CircleAlert aria-hidden="true" className="size-3.5" />}
      {label}
    </span>
  );
}
