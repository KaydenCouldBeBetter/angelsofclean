-- Angels of Clean — B2: require the admin role claim for all RLS access
-- Run in the Supabase SQL Editor AFTER granting your own account the admin
-- role (see below), or you will lock yourself out of the admin panel.
--
-- 001 granted access on auth.role() = 'authenticated' alone, so ANY Supabase
-- account could read every customer's address, phone, and notes. These
-- policies require app_metadata.role = 'admin' instead. app_metadata lives in
-- the JWT and can only be set server-side (dashboard or service role) — a
-- client can never grant itself this claim (unlike user_metadata).
--
-- Apply order:
--   1. Grant your admin account the role:
--        update auth.users
--        set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                                || '{"role": "admin"}'::jsonb
--        where email = 'YOUR_ADMIN_EMAIL';
--   2. Run this migration.
--   3. Log out of the admin panel and back in so the session JWT picks up
--      the new claim.
--
-- The public booking flow is unaffected: submitBooking inserts through the
-- service_role client (lib/supabase/service.ts), which bypasses RLS. There is
-- still deliberately no insert/delete policy on bookings and no anon policy
-- on any table.

-- bookings: admin UI reads and updates; all inserts go through service_role.
drop policy "admin_select_bookings" on bookings;
drop policy "admin_update_bookings" on bookings;

create policy "admin_select_bookings" on bookings
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_update_bookings" on bookings
  for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- employees: admin UI only reads the roster.
drop policy "admin_select_employees" on employees;

create policy "admin_select_employees" on employees
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- booking_employees: assignEmployees deletes then inserts; queries embed-select.
drop policy "admin_all_booking_employees" on booking_employees;

create policy "admin_all_booking_employees" on booking_employees
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- activity_log: admin actions insert entries; booking detail selects them.
drop policy "admin_all_activity_log" on activity_log;

create policy "admin_all_activity_log" on activity_log
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
