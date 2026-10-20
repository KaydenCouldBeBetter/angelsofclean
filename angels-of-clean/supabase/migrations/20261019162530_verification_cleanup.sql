-- Angels of Clean — verification pass #1 cleanup
-- Apply after 20261019152751_booking_access.sql.
--
-- 1. Admins create bookings through their own session, not the service role.
--    CLAUDE.md keeps the service role for the public booking and quote
--    inserts only, but adminCreateBooking (app/actions/submitBooking.ts) used
--    it too, because authenticated had no INSERT on bookings. This adds an
--    admin-only insert policy and grant for exactly what the admin path
--    writes:
--      * bookings: the columns createBooking sets, nothing else (so status
--        always starts at its default, pending), read back with
--        `returning id, booking_number` (select is already granted)
--      * activity_log: one entry; the existing admin insert policy and grant
--        already allow it, with actor = the admin's own email
--    The admin path no longer writes booking_access (admins add entry
--    instructions on the booking's page through set_booking_access, whose
--    grants 20261019152751 already gave authenticated), and it gets no DELETE
--    on bookings.
-- 2. The service role keeps only INSERT on booking_access. The public path's
--    rollback deletes the bookings row, and the foreign key's cascade removes
--    the access row as the table owner, so it needs nothing more here.
-- 3. booking_status_transition_allowed moves out of the API. Every function in
--    `public` is callable over /rpc. It can't simply be revoked from
--    authenticated, because the status trigger and set_booking_status are
--    security invoker and call it as the signed-in admin, so it moves to a
--    `private` schema that PostgREST doesn't expose (supabase/config.toml
--    exposes public and graphql_public), and those two functions look there.
--
-- Until this has been run, admin-created bookings fail with "Something went
-- wrong. Please try again." (the app no longer falls back to the service
-- role). Public bookings and quotes are unaffected.
--
-- After applying, run `npm run db:types`.

-- 1. Admin-created bookings ---------------------------------------------------------

create policy "admin_insert_bookings" on bookings
  for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Column-level, so an admin can't insert a booking that skips the status flow
-- (the transition trigger only checks updates) or backdate submitted_at.
-- booking_number is an identity column: it needs no sequence privilege.
-- A new column the admin form writes must be added here.
grant insert (
  client_name, email, phone, service_type, frequency,
  address, city, zip, bedrooms, bathrooms, notes,
  scheduled_date, time_slot, start_at, end_at
) on table bookings to authenticated;

-- 2. booking_access: the service role only inserts --------------------------------

revoke all on table booking_access from service_role;
grant insert on table booking_access to service_role;

-- 3. booking_status_transition_allowed out of the API ----------------------------

create schema if not exists private;
comment on schema private is 'Helpers used by functions in public. Not exposed over the API.';

-- Only signed-in admins change a booking's status (RLS on bookings), and the
-- trigger and set_booking_status run as them.
grant usage on schema private to authenticated;

alter function public.booking_status_transition_allowed(booking_status, booking_status)
  set schema private;

revoke execute on function private.booking_status_transition_allowed(booking_status, booking_status)
  from public, anon;
grant execute on function private.booking_status_transition_allowed(booking_status, booking_status)
  to authenticated;

-- Both call it unqualified; plpgsql resolves the name at run time.
alter function public.enforce_booking_status_transition()
  set search_path = public, private;
alter function public.set_booking_status(uuid, booking_status, text)
  set search_path = public, private;
