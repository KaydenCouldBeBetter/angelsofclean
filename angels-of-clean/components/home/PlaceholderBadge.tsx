// Marks homepage content the owner has not replaced yet (lib/homepage-content.ts).
// Same amber treatment as the legal pages' "[To be provided]" placeholders.
export default function PlaceholderBadge() {
  return (
    <span className="block w-fit rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300">
      Placeholder
    </span>
  );
}
