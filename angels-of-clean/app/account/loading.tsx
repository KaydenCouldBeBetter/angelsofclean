// Shown inside the portal frame while a page's data loads, so a click on a nav
// link gets feedback instead of leaving the old page frozen on screen.
function Block({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-line motion-reduce:animate-none ${className}`} />
  );
}

export default function AccountLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <Block className="h-8 w-56" />
        <Block className="h-28" />
        <Block className="h-28" />
        <Block className="h-40" />
      </div>
    </div>
  );
}
