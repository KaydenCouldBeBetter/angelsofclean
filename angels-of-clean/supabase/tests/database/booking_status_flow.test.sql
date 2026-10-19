-- Booking status flow (backlog B12,
-- supabase/migrations/20261019032629_booking_status_flow.sql): every status
-- change through set_booking_status and through a direct update, who may call
-- it, and the append-only activity log.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(62);

-- Every (from, to) pair of statuses, and whether the flow allows it. This list
-- is written out on purpose instead of calling
-- booking_status_transition_allowed(), so the test checks the function.
create table test_status_pairs as
select f.s as from_status,
       t.s as to_status,
       (f.s::text, t.s::text) in (
         ('pending',   'confirmed'),
         ('confirmed', 'active'),
         ('active',    'done'),
         ('pending',   'cancelled'),
         ('confirmed', 'cancelled'),
         ('active',    'cancelled')
       ) as allowed,
       null::uuid as rpc_booking,
       null::uuid as direct_booking
  from unnest(enum_range(null::booking_status)) f(s)
 cross join unnest(enum_range(null::booking_status)) t(s);

create function test_new_booking(p_status booking_status)
returns uuid
language sql
as $$
  insert into bookings (client_name, email, phone, service_type, frequency,
                        address, city, zip, bedrooms, bathrooms,
                        scheduled_date, time_slot, start_at, end_at, status)
  values ('Test Client', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
          '1 Main St', 'Syracuse', '13202', 2, 1,
          '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00', p_status)
  returning id;
$$;

-- Two bookings per pair, one for each way of changing the status.
update test_status_pairs
   set rpc_booking    = test_new_booking(from_status),
       direct_booking = test_new_booking(from_status);

grant select on test_status_pairs to anon, authenticated;

-- An admin, through set_booking_status -------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "email": "admin@test.com", "app_metadata": {"role": "admin"}}';

-- 25 tests
select is(
         set_booking_status(rpc_booking, to_status, 'Moved to ' || to_status) ->> 'status',
         case when allowed then 'changed' else 'refused' end,
         format('set_booking_status %s → %s is %s',
                from_status, to_status, case when allowed then 'allowed' else 'refused' end)
       )
  from test_status_pairs
 order by from_status, to_status;

select is(
         (select count(*)
            from test_status_pairs p
            join bookings b on b.id = p.rpc_booking
           where b.status <> case when p.allowed then p.to_status else p.from_status end),
         0::bigint,
         'allowed changes are saved; refused ones leave the status as it was'
       );

select results_eq(
         $$ select p.from_status::text, p.to_status::text, a.actor, a.action, a.description
              from test_status_pairs p
              join activity_log a on a.booking_id = p.rpc_booking
             order by 1, 2 $$,
         $$ select from_status::text, to_status::text, 'admin@test.com'::text,
                   'status_' || to_status, 'Moved to ' || to_status || ' by admin@test.com'
              from test_status_pairs
             where allowed
             order by 1, 2 $$,
         'each allowed change logs one entry with the actor from the JWT; refused ones log nothing'
       );

select is(
         set_booking_status(gen_random_uuid(), 'confirmed', 'Confirmed') ->> 'status',
         'not_found',
         'a missing booking is reported as not_found'
       );

select throws_ok(
         format($$ select set_booking_status(%L, 'confirmed', '  ') $$,
                (select rpc_booking from test_status_pairs
                  where from_status = 'pending' and to_status = 'pending')),
         '22004', null,
         'a blank description is refused'
       );

-- An admin, updating bookings directly (the trigger) --------------------------------

-- 20 tests; updates that keep the same status aren't status changes.
select case
         when allowed then
           lives_ok(
             format('update bookings set status = %L where id = %L', to_status, direct_booking),
             format('direct update %s → %s is allowed', from_status, to_status))
         else
           throws_ok(
             format('update bookings set status = %L where id = %L', to_status, direct_booking),
             '23514', null,
             format('direct update %s → %s is refused', from_status, to_status))
       end
  from test_status_pairs
 where from_status <> to_status
 order by from_status, to_status;

select lives_ok(
         format($$ update bookings set notes = 'Gate code changed' where id = %L $$,
                (select direct_booking from test_status_pairs
                  where from_status = 'cancelled' and to_status = 'cancelled')),
         'other columns of a cancelled booking can still be edited'
       );

-- Not an admin ------------------------------------------------------------------------

set local request.jwt.claims to
  '{"role": "authenticated", "email": "customer@test.com", "app_metadata": {}}';

select throws_ok(
         format($$ select set_booking_status(%L, 'confirmed', 'Confirmed') $$,
                (select rpc_booking from test_status_pairs
                  where from_status = 'pending' and to_status = 'pending')),
         '42501', null,
         'a signed-in user without the admin role is refused'
       );

select is(
         (select count(*) from activity_log),
         0::bigint,
         'a non-admin cannot read the activity log'
       );

select throws_ok(
         format($$ insert into activity_log (booking_id, description) values (%L, 'Hi') $$,
                (select rpc_booking from test_status_pairs
                  where from_status = 'pending' and to_status = 'pending')),
         '42501', null,
         'a non-admin cannot write to the activity log'
       );

-- user_metadata can be set by the user themselves, so it must not count.
set local request.jwt.claims to
  '{"role": "authenticated", "email": "customer@test.com", "user_metadata": {"role": "admin"}}';

select throws_ok(
         format($$ select set_booking_status(%L, 'confirmed', 'Confirmed') $$,
                (select rpc_booking from test_status_pairs
                  where from_status = 'pending' and to_status = 'pending')),
         '42501', null,
         'a self-assigned user_metadata role is refused'
       );

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
         format($$ select set_booking_status(%L, 'confirmed', 'Confirmed') $$,
                (select rpc_booking from test_status_pairs
                  where from_status = 'pending' and to_status = 'pending')),
         '42501', null,
         'anon may not call set_booking_status'
       );

-- The activity log is append-only ------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "email": "admin@test.com", "app_metadata": {"role": "admin"}}';

select throws_ok(
         $$ update activity_log set description = 'Edited' $$,
         '42501', null,
         'an admin cannot edit activity entries'
       );

select throws_ok(
         $$ delete from activity_log $$,
         '42501', null,
         'an admin cannot delete activity entries'
       );

select throws_ok(
         format($$ insert into activity_log (booking_id, description, actor)
                   values (%L, 'Crew changed', 'someone@else.com') $$,
                (select rpc_booking from test_status_pairs
                  where from_status = 'pending' and to_status = 'pending')),
         '42501', null,
         'an admin cannot log an entry as someone else'
       );

select lives_ok(
         format($$ insert into activity_log (booking_id, description) values (%L, 'Crew changed') $$,
                (select rpc_booking from test_status_pairs
                  where from_status = 'pending' and to_status = 'pending')),
         'an admin can append an entry'
       );

select is(
         (select actor from activity_log where description = 'Crew changed'),
         'admin@test.com',
         'a directly inserted entry takes its actor from the JWT'
       );

-- As the table owner ---------------------------------------------------------------------

reset role;

select throws_ok(
         format($$ update bookings set status = 'pending' where id = %L $$,
                (select rpc_booking from test_status_pairs
                  where from_status = 'cancelled' and to_status = 'cancelled')),
         '23514', null,
         'not even the table owner can reopen a cancelled booking'
       );

select is(
         (select b.status::text || ' / ' || count(a.id)
            from test_status_pairs p
            join bookings b on b.id = p.rpc_booking
            left join activity_log a on a.booking_id = b.id and a.description <> 'Crew changed'
           where p.from_status = 'pending' and p.to_status = 'pending'
           group by b.status),
         'pending / 0',
         'the refused callers changed nothing and logged nothing'
       );

select * from finish();
rollback;
