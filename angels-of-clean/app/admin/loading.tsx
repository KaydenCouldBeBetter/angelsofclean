// Shown inside the admin shell while a page's data loads, so a click on a
// sidebar link gets feedback instead of leaving the old page frozen on screen.
function Block({ className }: { className: string }) {
  return (
    <div
      className={`rounded-xl bg-[#e4e9e7] animate-pulse motion-reduce:animate-none ${className}`}
    />
  );
}

export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex-1 overflow-auto bg-[#f7f9f8]"
    >
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="flex flex-col gap-6 p-8">
        <Block className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Block className="h-24" />
          <Block className="h-24" />
          <Block className="h-24" />
          <Block className="h-24" />
        </div>
        <Block className="h-64" />
      </div>
    </div>
  );
}
