-- Entry instructions (backlog B38,
-- supabase/migrations/20261019152751_booking_access.sql): only admins can read
-- or change booking_access, set_booking_access logs that they changed but
-- never what they say, and the public insert path (service role) still works.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

create function test_new_booking()
returns uuid
language sql
as $$
  insert into bookings (client_name, email, phone, service_type, frequency,
                        address, city, zip, bedrooms, bathrooms,
                        scheduled_date, time_slot, start_at, end_at)
  values ('Test Client', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
          '1 Main St', 'Syracuse', '13202', 2, 1,
          '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00')
  returning id;
$$;

-- stored: has instructions from the start. edited: changed through the RPC.
-- via_service: written by the service role, like the booking form.
create table test_ids as
select test_new_booking() as stored,
       test_new_booking() as edited,
       test_new_booking() as via_service;

insert into booking_access (booking_id, instructions)
select stored, 'Gate code 4412' from test_ids;

grant select on test_ids to anon, authenticated, service_role;

-- The public booking form (service role) ---------------------------------------------

set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';

select lives_ok(
         $$ insert into booking_access (booking_id, instructions)
            select via_service, 'Key in the lockbox, code 9071' from test_ids $$,
         'the service role (public booking form) can store entry instructions'
       );

-- An admin -------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "email": "admin@test.com", "app_metadata": {"role": "admin"}}';

select is(
         (select instructions from booking_access where booking_id = (select stored from test_ids)),
         'Gate code 4412',
         'an admin can read entry instructions'
       );

select is(
         set_booking_access((select edited from test_ids), '  Side door, code 1234 ') ->> 'status',
         'saved',
         'an admin can add entry instructions'
       );

select is(
         (select instructions from booking_access where booking_id = (select edited from test_ids)),
         'Side door, code 1234',
         'they are stored trimmed'
       );

select is(
         set_booking_access((select edited from test_ids), 'Side door, code 1234') ->> 'status',
         'unchanged',
         'saving the same instructions again changes nothing'
       );

select is(
         set_booking_access((select edited from test_ids), 'Side door, code 5678') ->> 'status',
         'saved',
         'an admin can change entry instructions'
       );

select is(
         (select instructions from booking_access where booking_id = (select edited from test_ids)),
         'Side door, code 5678',
         'the change is stored'
       );

select is(
         set_booking_access((select edited from test_ids), '   ') ->> 'status',
         'removed',
         'a blank value removes them'
       );

select is(
         (select count(*) from booking_access where booking_id = (select edited from test_ids)),
         0::bigint,
         'no row is left behind once they are removed'
       );

select is(
         set_booking_access((select edited from test_ids), '') ->> 'status',
         'unchanged',
         'removing instructions that are already gone changes nothing'
       );

-- A set, not a list: now() is the same for every entry in one transaction.
select set_eq(
         $$ select description, actor, action
              from activity_log
             where booking_id = (select edited from test_ids) $$,
         $$ values ('Entry instructions added by admin@test.com',   'admin@test.com', 'access_updated'),
                   ('Entry instructions updated by admin@test.com', 'admin@test.com', 'access_updated'),
                   ('Entry instructions removed by admin@test.com', 'admin@test.com', 'access_removed') $$,
         'each change logs one entry that says what happened and who did it'
       );

select is(
         (select count(*) from activity_log
           where booking_id in (select stored from test_ids
                                union all select edited from test_ids
                                union all select via_service from test_ids)
             and description ~* '1234|5678|4412|9071|code|door'),
         0::bigint,
         'no activity entry repeats the instructions'
       );

select is(
         set_booking_access(gen_random_uuid(), 'Code 1') ->> 'status',
         'not_found',
         'a missing booking is reported as not_found'
       );

select throws_ok(
         format($$ select set_booking_access(%L, %L) $$,
                (select edited from test_ids), repeat('x', 501)),
         '23514', null,
         'instructions over 500 characters are refused'
       );

select lives_ok(
         format($$ select set_booking_access(%L, %L) $$,
                (select edited from test_ids), repeat('x', 500)),
         'instructions of exactly 500 characters are accepted'
       );

select throws_ok(
         $$ insert into booking_access (booking_id, instructions)
            select edited, '   ' from test_ids
            on conflict (booking_id) do update set instructions = excluded.instructions $$,
         '23514', null,
         'blank instructions cannot be stored directly either'
       );

-- Not an admin ------------------------------------------------------------------------------

set local request.jwt.claims to
  '{"role": "authenticated", "email": "customer@test.com", "app_metadata": {}}';

select is(
         (select count(*) from booking_access),
         0::bigint,
         'a signed-in user without the admin role cannot read entry instructions'
       );

select throws_ok(
         $$ select set_booking_access((select stored from test_ids), 'Code 0000') $$,
         '42501', null,
         'a non-admin cannot call set_booking_access'
       );

select throws_ok(
         $$ insert into booking_access (booking_id, instructions)
            select edited, 'Code 0000' from test_ids $$,
         '42501', null,
         'a non-admin cannot add entry instructions directly'
       );

-- RLS hides the rows, so these match nothing; checked as the owner below.
select lives_ok(
         $$ update booking_access set instructions = 'Code 0000' $$,
         'a non-admin update runs but matches no rows'
       );

select lives_ok(
         $$ delete from booking_access $$,
         'a non-admin delete runs but matches no rows'
       );

-- user_metadata can be set by the user themselves, so it must not count.
set local request.jwt.claims to
  '{"role": "authenticated", "email": "customer@test.com", "user_metadata": {"role": "admin"}}';

select is(
         (select count(*) from booking_access),
         0::bigint,
         'a self-assigned user_metadata role cannot read entry instructions'
       );

select throws_ok(
         $$ select set_booking_access((select stored from test_ids), 'Code 0000') $$,
         '42501', null,
         'a self-assigned user_metadata role cannot call set_booking_access'
       );

-- Signed out (anon) -------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
         $$ select count(*) from booking_access $$,
         '42501', null,
         'anon has no access to entry instructions'
       );

select throws_ok(
         $$ insert into booking_access (booking_id, instructions)
            select edited, 'Code 0000' from test_ids $$,
         '42501', null,
         'anon cannot add entry instructions'
       );

select throws_ok(
         $$ select set_booking_access((select stored from test_ids), 'Code 0000') $$,
         '42501', null,
         'anon may not call set_booking_access'
       );

-- As the table owner ------------------------------------------------------------------------

reset role;

select is(
         (select instructions from booking_access where booking_id = (select stored from test_ids)),
         'Gate code 4412',
         'the refused callers changed nothing'
       );

select is(
         (select instructions from booking_access where booking_id = (select via_service from test_ids)),
         'Key in the lockbox, code 9071',
         'the service role''s row was stored'
       );

select ok(
         (select relrowsecurity from pg_class where oid = 'public.booking_access'::regclass),
         'row level security is on'
       );

select is(
         (select count(*) from activity_log where booking_id = (select stored from test_ids)),
         0::bigint,
         'the refused callers logged nothing'
       );

delete from bookings where id = (select stored from test_ids);

select is(
         (select count(*) from booking_access where booking_id = (select stored from test_ids)),
         0::bigint,
         'deleting a booking deletes its entry instructions'
       );

select * from finish();
rollback;
