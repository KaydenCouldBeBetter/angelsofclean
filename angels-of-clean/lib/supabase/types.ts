// Hand-written row types mirroring the Supabase schema (see plan SQL).
// Not generated — keep in sync manually if columns change.

export type BookingStatus = "pending" | "confirmed" | "active" | "done" | "cancelled";

// Row shapes are `type` aliases, not `interface`s — TypeScript interfaces are
// "open" (can be augmented via declaration merging) and don't satisfy a
// `Record<string, unknown>` conditional-type check the way object type
// literals do, which is exactly what postgrest-js's GenericTable requires.
export type EmployeeRow = {
  id: string;
  name: string;
  initials: string;
  phone: string;
  hired_date: string;
  created_at: string;
};

export type BookingRow = {
  id: string;
  booking_number: number;
  client_name: string;
  email: string;
  phone: string;
  service_type: "standard" | "deep" | "moveinout";
  frequency: "one-time" | "weekly" | "bi-weekly" | "monthly";
  address: string;
  city: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  notes: string | null;
  scheduled_date: string;
  time_slot: "morning" | "afternoon";
  start_at: string;
  end_at: string;
  status: BookingStatus;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

export type BookingEmployeeRow = {
  booking_id: string;
  employee_id: string;
  assigned_at: string;
};

export type ActivityLogRow = {
  id: string;
  booking_id: string;
  description: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: EmployeeRow;
        Insert: Omit<EmployeeRow, "id" | "created_at">;
        Update: Partial<Omit<EmployeeRow, "id" | "created_at">>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: Omit<
          BookingRow,
          "id" | "booking_number" | "status" | "submitted_at" | "created_at" | "updated_at"
        > & {
          status?: BookingStatus;
        };
        Update: Partial<Omit<BookingRow, "id" | "booking_number" | "created_at">>;
        Relationships: [];
      };
      booking_employees: {
        Row: BookingEmployeeRow;
        Insert: Omit<BookingEmployeeRow, "assigned_at">;
        Update: Partial<BookingEmployeeRow>;
        Relationships: [
          {
            foreignKeyName: "booking_employees_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_employees_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_log: {
        Row: ActivityLogRow;
        Insert: Omit<ActivityLogRow, "id" | "created_at">;
        Update: Partial<Omit<ActivityLogRow, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "activity_log_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
