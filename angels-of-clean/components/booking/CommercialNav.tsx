export default function CommercialNav() {
  return (
    <nav className="hidden md:flex w-full border-b border-zinc-200 bg-white">
      <div className="w-full max-w-screen-xl mx-auto px-20 h-20 flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-teal-800">Angels of Clean</div>
          <div className="text-xs text-zinc-500 mt-0.5">Commercial Services</div>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm text-zinc-600">(315) 555-0100</span>
          <button
            type="button"
            className="px-5 py-2 border border-zinc-300 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Log In
          </button>
        </div>
      </div>
    </nav>
  );
}
