"use client";

import { Search } from "lucide-react";

export default function BookingsSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative ml-auto">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#5c5c5e]"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        className="h-8 w-[200px] rounded-md border border-[#e2e8e6] bg-white pl-8 pr-3 text-[12px] text-[#1c1c1e] placeholder:text-[#9ca3af]"
      />
    </div>
  );
}
