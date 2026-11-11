// Shared look for the Customers forms: the admin's own card, input and button
// styles (see EntryInstructions and the bookings pages).

export const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-[#c9d3cf] bg-white px-3 text-sm text-[#1c1c1e]";
export const PRIMARY_BUTTON =
  "h-9 px-4 flex-shrink-0 rounded-lg bg-primary text-white text-[13px] font-semibold hover:bg-primary-pressed transition-colors disabled:opacity-50";
export const SECONDARY_BUTTON =
  "h-9 px-4 flex-shrink-0 rounded-lg border border-[#e2e8e6] bg-white text-primary text-[13px] font-semibold hover:bg-[#eef1ef] transition-colors disabled:opacity-50";
export const DANGER_BUTTON =
  "h-9 px-4 flex-shrink-0 rounded-lg border border-[#c0392b] bg-white text-[#c0392b] text-[13px] font-semibold hover:bg-[#feefee] transition-colors disabled:opacity-50";

// A label above its input, never a placeholder alone. `id` ties them together.
export function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[#1c1c1e]">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[#5c5c5e]">{hint}</p>}
    </div>
  );
}

// An error from a failed action: icon-free but announced at once, in the
// admin's error red on its tint (the pair the admin pages already use).
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-[#c0392b] bg-[#feefee] px-3 py-2 text-[13px] text-[#1c1c1e]">
      {children}
    </p>
  );
}
