import { cn } from "@/lib/utils";

interface ComingSoonButtonProps {
  children: string;
  /** Size and layout; the look comes from here. */
  className?: string;
}

// A customer-side control that isn't built yet (Log In and Create Account wait
// for customer accounts). Shown disabled and labelled, like the admin side's
// ComingSoonButton, instead of a live-looking button that does nothing.
export default function ComingSoonButton({ children, className }: ComingSoonButtonProps) {
  return (
    <button
      type="button"
      disabled
      className={cn(
        "inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-zinc-500",
        className,
      )}
    >
      <span>{children}</span>
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
        Coming soon
      </span>
    </button>
  );
}
