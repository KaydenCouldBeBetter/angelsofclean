-- Admin preferences (supabase/migrations/20261113202614_admin_preferences.sql):
-- an admin can read and save only their own row; no one can change whose row it
-- is or delete one; every value is checked by the database; a customer, a
-- "user_metadata admin" and an anonymous visitor get nothing; and the row goes
-- when the account does.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin1@test.com',   now()),
  ('00000000-0000-0000-0000-0000000000a2', 'admin2@test.com',   now()),
  ('00000000-0000-0000-0000-0000000000c1', 'customer@test.com', now());

-- admin2 already has a row, created with only user_id so the defaults show.
insert into admin_preferences (user_id) values ('00000000-0000-0000-0000-0000000000a2');

select results_eq(
         $$ select landing_page, calendar_view, week_starts_on, calendar_start_hour::int,
                   calendar_end_hour::int, unassigned_list_collapsed, bookings_default_filter
              from admin_preferences where user_id = '00000000-0000-0000-0000-0000000000a2' $$,
         $$ values ('dashboard'::text, 'week'::text, 'sunday'::text, 7, 17, false, 'today'::text) $$,
         'a new row holds the panel as it was before Settings existed'
       );

-- admin1 ---------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000a1", "email": "admin1@test.com", "app_metadata": {"role": "admin"}}';

select is((select count(*) from admin_preferences), 0::bigint,
          'an admin does not see another admin''s row');

select is(
         save_admin_preferences('calendar', 'month', 'monday', 6::smallint, 20::smallint, true, 'upcoming') ->> 'status',
         'saved',
         'an admin can save preferences'
       );

select results_eq(
         $$ select user_id::text, landing_page, calendar_view, week_starts_on, calendar_start_hour::int,
                   calendar_end_hour::int, unassigned_list_collapsed, bookings_default_filter
              from admin_preferences $$,
         $$ values ('00000000-0000-0000-0000-0000000000a1'::text, 'calendar'::text, 'month'::text, 'monday'::text,
                    6, 20, true, 'upcoming'::text) $$,
         'the row is the caller''s own, with every value saved (and it is the only one visible)'
       );

select is(
         save_admin_preferences('bookings', 'week', 'sunday', 8::smallint, 24::smallint, false, 'all') ->> 'status',
         'saved',
         'saving again works, and midnight is a valid end hour'
       );

select results_eq(
         $$ select count(*)::int, min(landing_page), min(calendar_end_hour)::int from admin_preferences $$,
         $$ values (1, 'bookings'::text, 24) $$,
         'saving again updates the same row instead of adding another'
       );

-- Another admin's row ------------------------------------------------------------------------------

-- admin1 tries to overwrite admin2's row; it is invisible to them, so nothing matches.
update admin_preferences set landing_page = 'bookings'
 where user_id = '00000000-0000-0000-0000-0000000000a2';

reset role;
select is(
         (select landing_page from admin_preferences where user_id = '00000000-0000-0000-0000-0000000000a2'),
         'dashboard',
         'an admin cannot change another admin''s row (it is invisible to them)'
       );

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000a1", "email": "admin1@test.com", "app_metadata": {"role": "admin"}}';

select throws_ok(
         $$ insert into admin_preferences (user_id) values ('00000000-0000-0000-0000-0000000000a2') $$,
         '42501', null,
         'an admin cannot insert a row for someone else'
       );

select throws_ok(
         $$ update admin_preferences set user_id = '00000000-0000-0000-0000-0000000000a2' $$,
         '42501', null,
         'user_id can never be changed'
       );

select throws_ok(
         $$ delete from admin_preferences $$,
         '42501', null,
         'no one can delete a preferences row through the API'
       );

-- Values the database refuses ---------------------------------------------------------------------------

select throws_ok(
         $$ select save_admin_preferences('settings', 'week', 'sunday', 7::smallint, 17::smallint, false, 'today') $$,
         '23514', null,
         'an unknown start page is refused'
       );
select throws_ok(
         $$ select save_admin_preferences('dashboard', 'day', 'sunday', 7::smallint, 17::smallint, false, 'today') $$,
         '23514', null,
         'an unknown calendar view is refused'
       );
select throws_ok(
         $$ select save_admin_preferences('dashboard', 'week', 'friday', 7::smallint, 17::smallint, false, 'today') $$,
         '23514', null,
         'an unknown first weekday is refused'
       );
select throws_ok(
         $$ select save_admin_preferences('dashboard', 'week', 'sunday', 7::smallint, 17::smallint, false, 'cancelled') $$,
         '23514', null,
         'an unknown bookings filter is refused'
       );
select throws_ok(
         $$ select save_admin_preferences('dashboard', 'week', 'sunday', 24::smallint, 25::smallint, false, 'today') $$,
         '23514', null,
         'a first hour of 24 is refused'
       );
select throws_ok(
         $$ select save_admin_preferences('dashboard', 'week', 'sunday', 0::smallint, 0::smallint, false, 'today') $$,
         '23514', null,
         'a last hour of 0 is refused'
       );
select throws_ok(
         $$ select save_admin_preferences('dashboard', 'week', 'sunday', 10::smallint, 13::smallint, false, 'today') $$,
         '23514', null,
         'fewer than four visible hours is refused'
       );
select lives_ok(
         $$ select save_admin_preferences('dashboard', 'week', 'sunday', 10::smallint, 14::smallint, false, 'today') $$,
         'exactly four visible hours is allowed'
       );
select throws_ok(
         $$ select save_admin_preferences(null, 'week', 'sunday', 7::smallint, 17::smallint, false, 'today') $$,
         '22004', null,
         'a null value is refused'
       );
select results_eq(
         $$ select landing_page, calendar_start_hour::int, calendar_end_hour::int from admin_preferences $$,
         $$ values ('dashboard'::text, 10, 14) $$,
         'every refused save left the row exactly as the last good save made it'
       );

-- admin2: updated_at moves on every save ----------------------------------------------------------------------

reset role;
update admin_preferences set updated_at = '2020-01-01' where user_id = '00000000-0000-0000-0000-0000000000a2';

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000a2", "email": "admin2@test.com", "app_metadata": {"role": "admin"}}';

select is(
         save_admin_preferences('calendar', 'week', 'sunday', 7::smallint, 17::smallint, false, 'today') ->> 'status',
         'saved',
         'the other admin can save their own row'
       );
select ok(
         (select updated_at > '2020-01-01' from admin_preferences),
         'a save moves updated_at'
       );
select is((select count(*) from admin_preferences), 1::bigint,
          'and they see only their own row, not admin1''s');

-- A customer ---------------------------------------------------------------------------------------------------

set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000c1", "email": "customer@test.com", "app_metadata": {"role": "customer"}}';

select throws_ok(
         $$ select save_admin_preferences('dashboard', 'week', 'sunday', 7::smallint, 17::smallint, false, 'today') $$,
         '42501', null,
         'a customer cannot save admin preferences'
       );
select is((select count(*) from admin_preferences), 0::bigint, 'a customer sees no rows');
select throws_ok(
         $$ insert into admin_preferences (user_id) values ('00000000-0000-0000-0000-0000000000c1') $$,
         '42501', null,
         'a customer cannot insert a row directly'
       );

-- Admin only in user_metadata (which a user can edit themselves) ---------------------------------------------------

set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000c1", "email": "customer@test.com", "user_metadata": {"role": "admin"}}';

select throws_ok(
         $$ select save_admin_preferences('dashboard', 'week', 'sunday', 7::smallint, 17::smallint, false, 'today') $$,
         '42501', null,
         'an admin role in user_metadata grants nothing'
       );
select is((select count(*) from admin_preferences), 0::bigint, 'and shows no rows');

-- An anonymous visitor --------------------------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
         $$ select count(*) from admin_preferences $$,
         '42501', null,
         'anon cannot read the table'
       );
select throws_ok(
         $$ select save_admin_preferences('dashboard', 'week', 'sunday', 7::smallint, 17::smallint, false, 'today') $$,
         '42501', null,
         'anon cannot call save_admin_preferences'
       );
select throws_ok(
         $$ insert into admin_preferences (user_id) values ('00000000-0000-0000-0000-0000000000a1') $$,
         '42501', null,
         'anon cannot insert'
       );

-- The row goes with the account --------------------------------------------------------------------------------------

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a2';
select is(
         (select count(*) from admin_preferences where user_id = '00000000-0000-0000-0000-0000000000a2'),
         0::bigint,
         'deleting the account deletes its preferences'
       );
select is(
         (select count(*) from admin_preferences where user_id = '00000000-0000-0000-0000-0000000000a1'),
         1::bigint,
         'and leaves everyone else''s alone'
       );

select * from finish();
rollback;
