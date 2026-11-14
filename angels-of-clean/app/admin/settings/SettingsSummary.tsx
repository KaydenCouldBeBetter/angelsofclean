import { daysAheadLabel, noticeLabel } from "@/lib/booking-rules";
import type { BookingControls } from "@/lib/supabase/booking-settings";

// A read-only strip of the shared booking rules at the top of Settings, in the
// same tile style as the Dashboard's stat cards. The editable controls are
// below; this is the at-a-glance answer to "what can customers book right now?".
export default function SettingsSummary({ controls }: { controls: BookingControls }) {
  const { settings, blackouts } = controls;
  const tiles = [
    {
      label: "Online booking",
      value: settings.paused ? "Paused" : "Open",
      sub: settings.paused ? "Customers see a notice" : "Customers can book",
      accent: settings.paused ? "bg-[#b45309]" : "bg-primary",
    },
    {
      label: "Minimum notice",
      value: noticeLabel(settings.minNoticeHours),
      sub: "Before a customer's visit",
      accent: "bg-primary",
    },
    {
      label: "Booking window",
      value: daysAheadLabel(settings.maxDaysAhead),
      sub: "Counted from today",
      accent: "bg-primary",
    },
    {
      label: "Closed days",
      value: String(blackouts.length),
      sub: blackouts.length === 1 ? "Upcoming day closed" : "Upcoming days closed",
      accent: "bg-primary",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4 xl:gap-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="relative overflow-hidden rounded-xl border border-[#e2e8e6] bg-white">
          <div className={`absolute bottom-0 left-0 top-0 w-1 ${tile.accent}`} />
          <div className="py-4 pl-6 pr-5">
            <dt className="text-xs text-[#5c5c5e]">{tile.label}</dt>
            <dd className="mt-1.5 text-2xl font-bold leading-tight text-[#1c1c1e]">{tile.value}</dd>
            <dd className="mt-1 text-xs text-[#5c5c5e]">{tile.sub}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
