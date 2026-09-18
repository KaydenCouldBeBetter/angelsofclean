"use client";

export default function BookingsSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ml-auto">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="&#128269; Search..."
        className="h-8 w-[200px] rounded-md border border-[#e2e8e6] bg-white px-3 text-[12px] text-[#1c1c1e] placeholder:text-[#9ca3af] outline-none focus:border-[#1a6b5a] focus:ring-1 focus:ring-[#1a6b5a]"
      />
    </div>
  );
}
