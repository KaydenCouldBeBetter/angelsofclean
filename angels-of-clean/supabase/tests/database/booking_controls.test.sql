-- Online booking controls (supabase/migrations/20261113205039_booking_controls.sql):
-- admins read the settings, closed days and audit trail but write only through
-- the three functions, each of which checks the admin claim and records the
-- change; anon may call get_booking_rules and nothing else; the public answer
-- carries no labels, no audit and no past dates; and every value is checked by
-- the database itself.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(74);

-- The starting point ---------------------------------------------------------------------

select is((select count(*) from booking_settings), 1::bigint, 'there is exactly one settings row');
select results_eq(
         $$ select online_booking_paused, pause_message, min_notice_hours::int, max_days_ahead::int from booking_settings $$,
         $$ values (false, ''::text, 0, 6) $$,
         'it starts open, with no minimum notice and a 6-day window'
       );
select throws_ok(
         $$ insert into booking_settings (id) values (false) $$,
         '23514', null,
         'a second settings row cannot be added'
       );
select throws_ok(
         $$ insert into booking_settings (id) values (true) $$,
         '23505', null,
         'nor a duplicate of the first'
       );

-- Hold today's New York date for the cases below.
create table test_dates as
select (now() at time zone 'America/New_York')::date as today;
grant select on test_dates to anon, authenticated;

-- A past closed day, which the public answer must leave out.
insert into blackout_dates (day, label) values ((select today - 3 from test_dates), 'long gone');

-- anon -----------------------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is(get_booking_rules() ->> 'paused', 'false', 'a visitor can read whether booking is paused');
select is(
         (select array_agg(k order by k) from jsonb_object_keys(get_booking_rules()) k),
         array['blackout_dates', 'max_days_ahead', 'min_notice_hours', 'pause_message', 'paused'],
         'the public answer has exactly five fields'
       );
select is(get_booking_rules() -> 'blackout_dates', '[]'::jsonb, 'a closed day that has passed is not in the public answer');

select throws_ok($$ select count(*) from booking_settings $$, '42501', null, 'anon cannot read the settings table');
select throws_ok($$ select count(*) from blackout_dates $$, '42501', null, 'anon cannot read closed days directly');
select throws_ok($$ select count(*) from settings_audit $$, '42501', null, 'anon cannot read the audit trail');
select throws_ok(
         $$ select save_booking_settings(true, 'x', 0::smallint, 6::smallint) $$,
         '42501', null, 'anon cannot save settings'
       );
select throws_ok($$ select add_blackout_date(current_date + 5, '') $$, '42501', null, 'anon cannot close a day');
select throws_ok($$ select remove_blackout_date(current_date + 5) $$, '42501', null, 'anon cannot reopen a day');

-- A customer -----------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000c1", "email": "customer@test.com", "app_metadata": {"role": "customer"}}';

select is((select count(*) from booking_settings), 0::bigint, 'a customer sees no settings row');
select is((select count(*) from blackout_dates), 0::bigint, 'a customer sees no closed days');
select is((select count(*) from settings_audit), 0::bigint, 'a customer sees no audit entries');
select throws_ok(
         $$ select save_booking_settings(true, 'x', 0::smallint, 6::smallint) $$,
         '42501', null, 'a customer cannot save settings'
       );
select throws_ok(
         $$ select add_blackout_date((select today + 5 from test_dates), '') $$,
         '42501', null, 'a customer cannot close a day'
       );
select throws_ok(
         $$ update booking_settings set online_booking_paused = true $$,
         '42501', null, 'a customer cannot update the settings directly'
       );
select is(get_booking_rules() ->> 'paused', 'false', 'a signed-in customer reads the public answer like anyone');

-- An admin only in user_metadata (which a user can edit themselves) ---------------------------------------------------

set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000c1", "email": "customer@test.com", "user_metadata": {"role": "admin"}}';

select throws_ok(
         $$ select save_booking_settings(true, 'x', 0::smallint, 6::smallint) $$,
         '42501', null, 'an admin role in user_metadata cannot save settings'
       );
select throws_ok(
         $$ select add_blackout_date((select today + 5 from test_dates), '') $$,
         '42501', null, 'nor close a day'
       );
select is((select count(*) from booking_settings), 0::bigint, 'nor read the settings');

-- An admin ----------------------------------------------------------------------------------------------------------

set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000a1", "email": "admin@test.com", "app_metadata": {"role": "admin"}}';

select is((select count(*) from booking_settings), 1::bigint, 'an admin reads the settings');
select is((select count(*) from blackout_dates), 1::bigint, 'an admin reads the closed days');

-- Nobody writes to the tables directly, admins included, so nothing skips the audit trail.
select throws_ok($$ update booking_settings set online_booking_paused = true $$, '42501', null, 'an admin cannot update the settings directly');
select throws_ok($$ insert into blackout_dates (day) values (current_date + 40) $$, '42501', null, 'an admin cannot insert a closed day directly');
select throws_ok($$ delete from blackout_dates $$, '42501', null, 'an admin cannot delete a closed day directly');
select throws_ok($$ insert into settings_audit (area, description) values ('x', 'y') $$, '42501', null, 'an admin cannot write an audit entry by hand');
select throws_ok($$ delete from settings_audit $$, '42501', null, 'an admin cannot delete an audit entry');
select throws_ok($$ update settings_audit set description = 'edited' $$, '42501', null, 'an admin cannot edit an audit entry');

-- save_booking_settings ----------------------------------------------------------------------------------------------

select is(
         save_booking_settings(true, '  Back Monday. ', 24::smallint, 30::smallint) ->> 'status',
         'saved',
         'an admin can save settings'
       );
select results_eq(
         $$ select online_booking_paused, pause_message, min_notice_hours::int, max_days_ahead::int, updated_by from booking_settings $$,
         $$ values (true, 'Back Monday.'::text, 24, 30, 'admin@test.com'::text) $$,
         'every value is saved, the message trimmed, and the admin recorded'
       );
select is((select count(*) from settings_audit where area = 'booking_settings'), 4::bigint, 'one audit entry for each of the four changes');
select results_eq(
         $$ select description from settings_audit where area = 'booking_settings' order by description $$,
         $$ values ('Changed how far ahead customers can book from 6 to 30 days'::text),
                   ('Changed minimum notice from 0 to 24 hours'),
                   ('Changed the pause message'),
                   ('Paused online booking') $$,
         'the entries say what changed'
       );
select is(
         (select count(*) from settings_audit where actor = 'admin@test.com'),
         4::bigint,
         'and who changed it, taken from the session'
       );

select is(
         save_booking_settings(true, 'Back Monday.', 24::smallint, 30::smallint) ->> 'status',
         'unchanged',
         'saving the same values again changes nothing'
       );
select is((select count(*) from settings_audit), 4::bigint, 'and writes no audit entry');

select is(save_booking_settings(false, 'Back Monday.', 24::smallint, 30::smallint) ->> 'status', 'saved', 'resuming booking saves');
select is(
         (select count(*) from settings_audit where description = 'Resumed online booking'),
         1::bigint,
         'and the new audit entry says it was resumed'
       );
select is((select count(*) from settings_audit), 5::bigint, 'exactly one');

-- Values the database refuses -----------------------------------------------------------------------------------------

select throws_ok($$ select save_booking_settings(false, '', 169::smallint, 6::smallint) $$, '23514', null, 'more than a week of notice is refused');
select throws_ok($$ select save_booking_settings(false, '', -1::smallint, 6::smallint) $$, '23514', null, 'negative notice is refused');
select throws_ok($$ select save_booking_settings(false, '', 0::smallint, 0::smallint) $$, '23514', null, 'a 0-day window is refused');
select throws_ok($$ select save_booking_settings(false, '', 0::smallint, 93::smallint) $$, '23514', null, 'a window past 92 days is refused');
select throws_ok(
         format($$ select save_booking_settings(false, %L, 0::smallint, 6::smallint) $$, repeat('a', 201)),
         '23514', null, 'a pause message over 200 characters is refused'
       );
select lives_ok(
         format($$ select save_booking_settings(false, %L, 0::smallint, 6::smallint) $$, repeat('a', 200)),
         'one of exactly 200 is allowed'
       );
select throws_ok($$ select save_booking_settings(null, '', 0::smallint, 6::smallint) $$, '22004', null, 'a null pause flag is refused');
select throws_ok($$ select save_booking_settings(false, '', null, 6::smallint) $$, '22004', null, 'a null notice is refused');
select results_eq(
         $$ select min_notice_hours::int, max_days_ahead::int from booking_settings $$,
         $$ values (0, 6) $$,
         'and every refused save left the last good one in place (the 200-character save above reset them)'
       );

-- add_blackout_date -----------------------------------------------------------------------------------------------------

select is(
         add_blackout_date((select today + 10 from test_dates), '  Thanksgiving ') ->> 'status',
         'added',
         'an admin can close a day'
       );
select is(
         (select label from blackout_dates where day = (select today + 10 from test_dates)),
         'Thanksgiving',
         'the label is trimmed'
       );
select is(
         (select created_by from blackout_dates where day = (select today + 10 from test_dates)),
         'admin@test.com',
         'and the admin recorded'
       );
select ok(
         exists (select 1 from settings_audit where area = 'blackout_dates' and description like 'Closed %(Thanksgiving)' and actor = 'admin@test.com'),
         'closing a day is audited with its label'
       );

select is(add_blackout_date((select today + 10 from test_dates), 'again') ->> 'status', 'exists', 'closing the same day twice reports it');
select is(
         (select count(*) from settings_audit where area = 'blackout_dates'),
         1::bigint,
         'and adds no second audit entry'
       );
select is(
         (select label from blackout_dates where day = (select today + 10 from test_dates)),
         'Thanksgiving',
         'nor changes the label'
       );

select is(add_blackout_date((select today from test_dates), '') ->> 'status', 'added', 'today can be closed');
select is(add_blackout_date((select today - 1 from test_dates), '') ->> 'status', 'past', 'a day that has passed cannot');
select is(add_blackout_date((select today + 730 from test_dates), '') ->> 'status', 'added', 'two years out is the last allowed day');
select is(add_blackout_date((select today + 731 from test_dates), '') ->> 'status', 'too_far', 'a day beyond that is refused');
select throws_ok($$ select add_blackout_date(null, '') $$, '22004', null, 'a null day is refused');
select throws_ok(
         format($$ select add_blackout_date((select today + 20 from test_dates), %L) $$, repeat('a', 101)),
         '23514', null, 'a label over 100 characters is refused'
       );
select ok(
         not exists (select 1 from blackout_dates where day = (select today - 1 from test_dates)),
         'and a refused day leaves no row behind'
       );

-- remove_blackout_date -------------------------------------------------------------------------------------------------------

select is(remove_blackout_date((select today + 10 from test_dates)) ->> 'status', 'removed', 'an admin can reopen a day');
select ok(
         not exists (select 1 from blackout_dates where day = (select today + 10 from test_dates)),
         'it is gone'
       );
select ok(
         exists (select 1 from settings_audit where area = 'blackout_dates' and description like 'Reopened %' and actor = 'admin@test.com'),
         'and the reopening is audited'
       );
select is(remove_blackout_date((select today + 10 from test_dates)) ->> 'status', 'not_found', 'reopening a day that is not closed is reported');
select throws_ok($$ select remove_blackout_date(null) $$, '22004', null, 'a null day is refused');

-- What the public sees now -----------------------------------------------------------------------------------------------------

select is(
         save_booking_settings(true, 'We''re closed for the holidays.', 12::smallint, 14::smallint) ->> 'status',
         'saved',
         'an admin pauses booking once more'
       );

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select results_eq(
         $$ select (r ->> 'paused')::boolean, r ->> 'pause_message', (r ->> 'min_notice_hours')::int, (r ->> 'max_days_ahead')::int
              from (select get_booking_rules() as r) x $$,
         $$ values (true, 'We''re closed for the holidays.'::text, 12, 14) $$,
         'a visitor sees the pause, its message, and the rules'
       );
select results_eq(
         $$ select jsonb_array_length(get_booking_rules() -> 'blackout_dates') $$,
         $$ values (2) $$,
         'and only the closed days that are today or later'
       );
select is(
         (select get_booking_rules() -> 'blackout_dates' ->> 0),
         (select today::text from test_dates),
         'soonest first'
       );
select ok(
         position('Thanksgiving' in get_booking_rules()::text) = 0 and position('long gone' in get_booking_rules()::text) = 0,
         'and never a label'
       );

select * from finish();
rollback;
