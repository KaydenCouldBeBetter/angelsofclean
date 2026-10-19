// Shown on the date step when the saved date had already passed by the time the
// customer came back, so an empty-looking picker doesn't read as lost progress.
export default function DateExpiredNotice() {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-800"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
      <p className="text-sm text-amber-900">
        <span className="font-semibold">Your saved date has passed.</span> Please choose a new
        date and time. Everything else you entered is still saved.
      </p>
    </div>
  );
}
