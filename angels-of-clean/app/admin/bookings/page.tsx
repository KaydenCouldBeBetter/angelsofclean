import { getJobsByDateFilter, getEmployees } from "@/lib/supabase/queries";
import { NewBookingButton } from "../NewBookingModal";
import BookingsList, { type FilterTab } from "./BookingsList";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const activeTab: FilterTab = (params.filter as FilterTab) || "today";

  const [jobs, employees] = await Promise.all([getJobsByDateFilter(activeTab), getEmployees()]);
  const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  const displayDate = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <>
      {/* Header */}
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8 justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">
            Bookings
          </h1>
          <p className="text-xs text-[#5c5c5e]">All scheduled jobs</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#5c5c5e]">{displayDate}</span>
          <NewBookingButton />
        </div>
      </header>

      <BookingsList jobs={jobs} employeeMap={employeeMap} activeTab={activeTab} />
    </>
  );
}
