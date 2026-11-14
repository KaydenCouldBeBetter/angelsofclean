// @vitest-environment node
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { HOME_SIZE_OPTIONS } from "@/lib/home-size";

// bookings.home_size repeats the app's allowed values as a CHECK. This reads the
// migration and fails if either side changes without the other.
const MIGRATION = path.resolve(__dirname, "..", "migrations", "20261113221252_booking_home_size.sql");
const sql = readFileSync(MIGRATION, "utf8")
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ");

describe("bookings.home_size matches lib/home-size.ts", () => {
  it("allows exactly the sizes the booking form offers", () => {
    const list = /constraint bookings_home_size_check check \(home_size in \(([^)]*)\)\)/.exec(sql)![1];
    expect(list.split(",").map((v) => v.trim().replace(/'/g, ""))).toEqual(HOME_SIZE_OPTIONS.map((o) => o.value));
  });

  it("is nullable, so bookings made before it was asked stay valid and show 'not recorded'", () => {
    expect(sql).toContain("alter table bookings add column home_size text;");
    expect(sql).not.toMatch(/home_size text not null/);
  });

  it("lets the admin session write it on a new booking, and nothing broader", () => {
    expect(sql).toContain("grant insert (home_size) on table bookings to authenticated");
  });
});

describe("set_booking_home_size", () => {
  const body = /create function set_booking_home_size\(.*?\$\$;/.exec(sql)![0];

  it("is admin only, and runs as the caller so row security still applies", () => {
    expect(body).toContain("coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin'");
    expect(body).not.toContain("security definer");
    expect(sql).toContain("revoke execute on function set_booking_home_size(uuid, text) from public, anon");
    expect(sql).toContain("grant execute on function set_booking_home_size(uuid, text) to authenticated");
  });

  it("never clears the size, and refuses a finished or cancelled booking", () => {
    expect(body).toContain("p_home_size is null");
    expect(body).toContain("v_booking.status in ('cancelled', 'done')");
  });

  it("logs every change, with who made it taken from the session", () => {
    expect(body).toContain("insert into activity_log (booking_id, description, actor, action)");
    expect(body).toContain("v_actor text := auth.jwt() ->> 'email'");
  });

  it("describes sizes in the activity log the same way the app words them", () => {
    for (const [value, words] of [
      ["under-1800", "under 1,800 sq ft"],
      ["1800-2500", "1,800 to 2,500 sq ft"],
      ["over-2500", "2,500 sq ft or more"],
      ["unsure", "not sure"],
    ]) {
      expect(body).toContain(`'${value}', '${words}'`);
    }
  });
});
