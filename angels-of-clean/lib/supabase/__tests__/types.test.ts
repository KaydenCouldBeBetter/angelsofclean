// Type-level checks: expectTypeOf and @ts-expect-error are enforced by
// `npx tsc --noEmit` (tests are in tsconfig); at runtime they are no-ops.
import { createClient } from "@supabase/supabase-js";
import { describe, expectTypeOf, it } from "vitest";
import type { Database as GeneratedDatabase } from "../database.types";
import type {
  AssignBookingEmployeesResult,
  BookingRow,
  BookingStatus,
  CommercialQuoteRow,
  Database,
} from "../types";

type Tables = Database["public"]["Tables"];

describe("lib/supabase/types", () => {
  it("narrows CHECK-constrained booking columns", () => {
    expectTypeOf<BookingRow["service_type"]>().toEqualTypeOf<"standard" | "deep" | "moveinout">();
    expectTypeOf<BookingRow["frequency"]>().toEqualTypeOf<
      "one-time" | "weekly" | "bi-weekly" | "monthly"
    >();
    expectTypeOf<BookingRow["time_slot"]>().toEqualTypeOf<"morning" | "afternoon">();
    expectTypeOf<BookingRow["status"]>().toEqualTypeOf<BookingStatus>();
  });

  it("narrows CHECK-constrained commercial quote columns", () => {
    expectTypeOf<CommercialQuoteRow["facility_type"]>().toEqualTypeOf<
      "office" | "retail" | "medical" | "warehouse" | "school" | "restaurant"
    >();
    expectTypeOf<CommercialQuoteRow["sqft_range"]>().toEqualTypeOf<"<1k" | "1k-2k" | "2k-5k" | "5k+">();
    expectTypeOf<CommercialQuoteRow["frequency"]>().toEqualTypeOf<
      "daily" | "2-3x" | "weekly" | "bi-weekly" | "monthly" | "one-time"
    >();
    expectTypeOf<CommercialQuoteRow["schedule_preference"]>().toEqualTypeOf<
      "before" | "during" | "after" | "weekends" | null
    >();
  });

  it("keeps every generated column and the generated Insert/Update optionality", () => {
    expectTypeOf<keyof BookingRow>().toEqualTypeOf<
      keyof GeneratedDatabase["public"]["Tables"]["bookings"]["Row"]
    >();
    expectTypeOf<keyof CommercialQuoteRow>().toEqualTypeOf<
      keyof GeneratedDatabase["public"]["Tables"]["commercial_quotes"]["Row"]
    >();

    const insert: Tables["bookings"]["Insert"] = {
      client_name: "A",
      email: "a@example.com",
      phone: "3155550100",
      service_type: "deep",
      frequency: "weekly",
      address: "1 Main St",
      city: "Syracuse",
      zip: "13202",
      bedrooms: 2,
      bathrooms: 1,
      scheduled_date: "2026-11-02",
      time_slot: "morning",
      start_at: "2026-11-02T13:00:00Z",
      end_at: "2026-11-02T17:00:00Z",
    };
    // @ts-expect-error a value the CHECK constraint rejects
    insert.service_type = "basic";
    // @ts-expect-error booking_number is an identity column
    insert.booking_number = 1;
    const update: Tables["commercial_quotes"]["Update"] = { schedule_preference: null };
    // @ts-expect-error a value the CHECK constraint rejects
    update.sqft_range = "10k+";
  });

  it("types the client's selects and the crew assignment RPC with the narrowed types", () => {
    // Builders only send a request when awaited; these never are.
    const db = createClient<Database>("http://localhost", "key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    expectTypeOf(db.from("bookings").select("time_slot, status"))
      .resolves.toHaveProperty("data")
      .toEqualTypeOf<{ time_slot: "morning" | "afternoon"; status: BookingStatus }[] | null>();

    expectTypeOf(
      db.rpc("assign_booking_employees", {
        p_booking_id: "b",
        p_employee_ids: [],
        p_expected_employee_ids: [],
      }),
    )
      .resolves.toHaveProperty("data")
      .toEqualTypeOf<AssignBookingEmployeesResult | null>();
  });
});
