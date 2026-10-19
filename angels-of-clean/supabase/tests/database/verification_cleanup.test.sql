-- Verification pass #1 cleanup
-- (supabase/migrations/20261019162530_verification_cleanup.sql): an admin
-- session can create a booking and its activity entry and nothing more,
-- nobody else can; the service role only inserts entry instructions and the
-- public rollback still leaves no orphan; booking_status_transition_allowed is
-- out of the API but the status flow still works.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- The insert createBooking makes (app/actions/submitBooking.ts), read back the
-- way the app does (returning id, booking_number). Security invoker, so it
-- runs with the caller's privileges and RLS.
create function test_create_booking(p_client text)
returns uuid
language plpgsql
as $$
declare
  v_id     uuid;
  v_number int;
begin
  insert into bookings (client_name, email, phone, service_type, frequency,
                        address, city, zip, bedrooms, bathrooms, notes,
                        scheduled_date, time_slot, start_at, end_at)
  values (p_client, 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
          '1 Main St', 'Syracuse', '13202', 2, 1, null,
          '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00')
  returning id, booking_number into v_id, v_number;

  if v_number is null then
    raise exception 'no booking number came back';
  end if;
  return v_id;
end;
$$;

create table test_ids (admin_booking uuid, public_booking uuid, pending_booking uuid);
insert into test_ids default values;
grant select, update on test_ids to anon, authenticated, service_role;

-- An admin, through their own session --------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "email": "admin@test.com", "app_metadata": {"role": "admin"}}';

select lives_ok(
         $$ update test_ids set admin_booking = test_create_booking('Admin Created') $$,
         'an admin can create a booking and read back its id and number'
       );

select is(
         (select status from bookings where id = (select admin_booking from test_ids)),
         'pending'::booking_status,
         'it starts as pending'
       );

select lives_ok(
         $$ insert into activity_log (booking_id, description)
            select admin_booking, 'Booking created by admin@test.com' from test_ids $$,
         'an admin can add its activity entry'
       );

select is(
         (select actor from activity_log where booking_id = (select admin_booking from test_ids)),
         'admin@test.com',
         'the entry''s actor is the admin''s own email'
       );

select throws_ok(
         $$ insert into bookings (client_name, email, phone, service_type, frequency,
                                  address, city, zip, bedrooms, bathrooms,
                                  scheduled_date, time_slot, start_at, end_at, status)
            values ('Skips Flow', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
                    '1 Main St', 'Syracuse', '13202', 2, 1,
                    '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00', 'done') $$,
         '42501', null,
         'an admin cannot create a booking that skips the status flow'
       );

select throws_ok(
         $$ insert into bookings (client_name, email, phone, service_type, frequency,
                                  address, city, zip, bedrooms, bathrooms,
                                  scheduled_date, time_slot, start_at, end_at, submitted_at)
            values ('Backdated', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
                    '1 Main St', 'Syracuse', '13202', 2, 1,
                    '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00', '2020-01-01') $$,
         '42501', null,
         'an admin cannot backdate submitted_at'
       );

select throws_ok(
         $$ delete from bookings where id = (select admin_booking from test_ids) $$,
         '42501', null,
         'an admin still cannot delete a booking'
       );

-- Not an admin ------------------------------------------------------------------------------

set local request.jwt.claims to
  '{"role": "authenticated", "email": "customer@test.com", "app_metadata": {}}';

select throws_ok(
         $$ select test_create_booking('Customer Account') $$,
         '42501', null,
         'a signed-in user without the admin role cannot create a booking'
       );

select throws_ok(
         $$ insert into activity_log (booking_id, description)
            select admin_booking, 'Booking created by customer@test.com' from test_ids $$,
         '42501', null,
         'a signed-in user without the admin role cannot add an activity entry'
       );

-- user_metadata can be set by the user themselves, so it must not count.
set local request.jwt.claims to
  '{"role": "authenticated", "email": "customer@test.com", "user_metadata": {"role": "admin"}}';

select throws_ok(
         $$ select test_create_booking('Self-Made Admin') $$,
         '42501', null,
         'a self-assigned user_metadata role cannot create a booking'
       );

-- Signed out (anon) ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
         $$ select test_create_booking('Anonymous') $$,
         '42501', null,
         'anon cannot create a booking directly'
       );

-- The public booking form (service role) -----------------------------------------------------

set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';

select lives_ok(
         $$ update test_ids set public_booking = test_create_booking('Public Form') $$,
         'the service role (public booking form) can still create a booking'
       );

select lives_ok(
         $$ insert into booking_access (booking_id, instructions)
            select public_booking, 'Gate code 4412' from test_ids $$,
         'the service role can still store entry instructions'
       );

select lives_ok(
         $$ insert into activity_log (booking_id, description)
            select public_booking, 'Booking submitted by client' from test_ids $$,
         'the service role can still add the activity entry'
       );

select throws_ok(
         $$ select count(*) from booking_access $$,
         '42501', null,
         'the service role cannot read entry instructions'
       );

select throws_ok(
         $$ update booking_access set instructions = 'Code 0000' $$,
         '42501', null,
         'the service role cannot change entry instructions'
       );

select throws_ok(
         $$ delete from booking_access $$,
         '42501', null,
         'the service role cannot delete entry instructions'
       );

-- submitBooking's rollback when the access insert fails: it deletes the booking.
select lives_ok(
         $$ delete from bookings where id = (select public_booking from test_ids) $$,
         'the service role can still take a booking back out'
       );

reset role;

select is(
         (select count(*) from booking_access where booking_id = (select public_booking from test_ids)),
         0::bigint,
         'the rollback leaves no orphan entry instructions'
       );

select is(
         (select count(*) from bookings where id = (select public_booking from test_ids)),
         0::bigint,
         'the rollback removed the booking'
       );

-- booking_status_transition_allowed is out of the API --------------------------------------

select hasnt_function(
         'public', 'booking_status_transition_allowed', array['booking_status', 'booking_status'],
         'booking_status_transition_allowed is no longer in public (callable over /rpc)'
       );

select ok(
         not has_function_privilege('anon',
           'private.booking_status_transition_allowed(booking_status, booking_status)', 'execute'),
         'anon cannot execute it'
       );

select ok(
         not has_schema_privilege('anon', 'private', 'usage'),
         'anon cannot use the private schema'
       );

-- ...and the status flow still works for an admin -------------------------------------------

update test_ids set pending_booking = test_create_booking('Status Flow');

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "email": "admin@test.com", "app_metadata": {"role": "admin"}}';

select is(
         set_booking_status((select pending_booking from test_ids), 'confirmed', 'Confirmed') ->> 'status',
         'changed',
         'set_booking_status still changes an allowed status'
       );

select is(
         set_booking_status((select pending_booking from test_ids), 'pending', 'Reopened') ->> 'status',
         'refused',
         'set_booking_status still refuses a move the flow doesn''t allow'
       );

select lives_ok(
         $$ update bookings set status = 'active' where id = (select pending_booking from test_ids) $$,
         'the trigger still allows an allowed direct update'
       );

select throws_ok(
         $$ update bookings set status = 'pending' where id = (select pending_booking from test_ids) $$,
         '23514', null,
         'the trigger still refuses a disallowed direct update'
       );

reset role;

select is(
         (select status from bookings where id = (select pending_booking from test_ids)),
         'active'::booking_status,
         'only the allowed changes were stored'
       );

select * from finish();
rollback;
