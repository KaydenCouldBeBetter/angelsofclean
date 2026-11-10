import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "No bookings yet" (Figma Booking History Empty 120:250): a neutral calendar
// icon in the brand tint, a friendly heading and one primary button.
export default function EmptyState({
  heading,
  body,
  actionHref,
  actionLabel,
}: {
  heading: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-white px-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary/5">
        <CalendarDays aria-hidden="true" className="size-7 text-primary" />
      </span>
      <h2 className="text-lg font-semibold text-ink">{heading}</h2>
      <p className="max-w-sm text-sm text-ink-muted">{body}</p>
      <Link href={actionHref} className={cn(buttonVariants(), "mt-2 h-11 px-5 text-sm font-semibold")}>
        {actionLabel}
      </Link>
    </div>
  );
}
