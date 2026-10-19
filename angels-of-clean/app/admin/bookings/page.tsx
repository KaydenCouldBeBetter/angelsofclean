import { getJobsByDateFilter, getEmployees } from "@/lib/supabase/queries";
import { NewBookingButton } from "../NewBookingModal";
import { formatNy } from "@/lib/datetime";
import { toStaffMap } from "@/lib/admin-types";
import BookingsList, { type FilterTab } from "./BookingsList";
import LoadError from "../LoadError";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const activeTab: FilterTab = (params.filter as FilterTab) || "today";

  const [jobs, employees] = await Promise.all([getJobsByDateFilter(activeTab), getEmployees()]);

  const displayDate = formatNy(new Date(), {
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

      {jobs.ok && employees.ok ? (
        <BookingsList
          jobs={jobs.data}
          employeeMap={toStaffMap(employees.data)}
          activeTab={activeTab}
        />
      ) : (
        <LoadError what="bookings" />
      )}
    </>
  );
}
