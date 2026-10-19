// Row types for the app, built from the generated lib/supabase/database.types.ts
// (npm run db:types — never hand-edit that file). The generator types text
// columns as plain `string` and jsonb as `Json`, so this file narrows the
// columns that have a CHECK constraint, and the jsonb results of
// assign_booking_employees and set_booking_status, back to the exact values
// the database allows.

import type { Database as GeneratedDatabase } from "./database.types";

type GeneratedPublic = GeneratedDatabase["public"];
type GeneratedTables = GeneratedPublic["Tables"];

export type BookingStatus = GeneratedPublic["Enums"]["booking_status"];

// Values allowed by each column's CHECK constraint (supabase/migrations/).
type BookingColumns = {
  service_type: "standard" | "deep" | "moveinout";
  frequency: "one-time" | "weekly" | "bi-weekly" | "monthly";
  time_slot: "morning" | "afternoon";
};

type CommercialQuoteColumns = {
  facility_type: "office" | "retail" | "medical" | "warehouse" | "school" | "restaurant";
  sqft_range: "<1k" | "1k-2k" | "2k-5k" | "5k+";
  frequency: "daily" | "2-3x" | "weekly" | "bi-weekly" | "monthly" | "one-time";
  schedule_preference: "before" | "during" | "after" | "weekends" | null;
};

// Replaces the types of C's columns in T, keeping T's optional/required
// modifiers (a homomorphic mapped type), so Insert/Update stay as generated.
type NarrowColumns<T, C> = { [K in keyof T]: K extends keyof C ? C[K] : T[K] };

// C may only name columns the generated row has, with types it accepts —
// a renamed, dropped or retyped column fails to compile here after db:types.
type NarrowTable<
  T extends { Row: object; Insert: object; Update: object; Relationships: unknown },
  C extends Partial<T["Row"]> & { [K in Exclude<keyof C, keyof T["Row"]>]: never },
> = {
  Row: NarrowColumns<T["Row"], C>;
  Insert: NarrowColumns<T["Insert"], C>;
  Update: NarrowColumns<T["Update"], C>;
  Relationships: T["Relationships"];
};

type BookingsTable = NarrowTable<GeneratedTables["bookings"], BookingColumns>;
type CommercialQuotesTable = NarrowTable<GeneratedTables["commercial_quotes"], CommercialQuoteColumns>;

export type EmployeeRow = GeneratedTables["employees"]["Row"];
export type BookingRow = BookingsTable["Row"];
export type BookingEmployeeRow = GeneratedTables["booking_employees"]["Row"];
export type ActivityLogRow = GeneratedTables["activity_log"]["Row"];
export type CommercialQuoteRow = CommercialQuotesTable["Row"];

// jsonb returned by assign_booking_employees
// (supabase/migrations/20261018142718_assign_booking_employees.sql).
export type AssignmentConflictRow = {
  employee_id: string;
  employee_name: string;
  booking_id: string;
  booking_number: number;
  start_at: string;
  end_at: string;
};

export type AssignBookingEmployeesResult =
  | { status: "saved"; added: string[]; removed: string[]; overridden: AssignmentConflictRow[] }
  | { status: "conflicts"; conflicts: AssignmentConflictRow[] }
  | { status: "stale" }
  | { status: "closed"; booking_status: BookingStatus }
  | { status: "not_found" };

// jsonb returned by set_booking_status
// (supabase/migrations/20261019035418_booking_status_flow.sql).
export type SetBookingStatusResult =
  | { status: "changed"; from: BookingStatus; to: BookingStatus }
  | { status: "refused"; booking_status: BookingStatus }
  | { status: "not_found" };

// set_booking_status isn't in database.types.ts until the owner applies its
// migration and runs npm run db:types. Its Args are written out here until
// then; afterwards, take them from GeneratedPublic["Functions"] like
// assign_booking_employees does.
type SetBookingStatusArgs = {
  p_booking_id: string;
  p_status: BookingStatus;
  p_description: string;
};

// The generated Database with the narrowed tables and function result swapped
// in. Passed to createServerClient / createClient so queries return these types.
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedPublic, "Tables" | "Functions"> & {
    Tables: Omit<GeneratedTables, "bookings" | "commercial_quotes"> & {
      bookings: BookingsTable;
      commercial_quotes: CommercialQuotesTable;
    };
    Functions: Omit<GeneratedPublic["Functions"], "assign_booking_employees" | "set_booking_status"> & {
      assign_booking_employees: {
        Args: GeneratedPublic["Functions"]["assign_booking_employees"]["Args"];
        Returns: AssignBookingEmployeesResult;
      };
      set_booking_status: {
        Args: SetBookingStatusArgs;
        Returns: SetBookingStatusResult;
      };
    };
  };
};
