-- Booking home size (supabase/migrations/20261113221252_booking_home_size.sql):
-- the column takes only the four sizes (and null for bookings made before it was
-- asked); an admin can set it when creating a booking and correct it afterwards
-- through set_booking_home_size, which logs every change and refuses a finished
-- or cancelled booking; and a customer, a "user_metadata admin" and an anonymous
-- visitor can change nothing.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(35);

create function test_new_booking(p_status booking_status, p_size text)
returns uuid
language sql
as $$
  insert into bookings (client_name, email, phone, service_type, frequency,
                        address, city, zip, bedrooms, bathrooms, home_size,
                        scheduled_date, time_slot, start_at, end_at, status)
  values ('Test Client', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
          '1 Main St', 'Syracuse', '13202', 2, 1, p_size,
          '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00', p_status)
  returning id;
$$;

create table test_ids as
select test_new_booking('pending', null)        as old_booking,   -- made before size was asked
       test_new_booking('pending', 'unsure')    as pending,
       test_new_booking('done', 'under-1800')   as done,
       test_new_booking('cancelled', 'over-2500') as cancelled;
grant select on test_ids to anon, authenticated;

-- The column itself -------------------------------------------------------------------------

select col_is_null('bookings', 'home_size', 'home_size is nullable, so bookings made before it was asked stay valid');
select is((select home_size from bookings where id = (select old_booking from test_ids)), null, 'and an old booking really has none');

select lives_ok($$ select test_new_booking('pending', 'under-1800') $$, 'under-1800 is accepted');
select lives_ok($$ select test_new_booking('pending', '1800-2500') $$, '1800-2500 is accepted');
select lives_ok($$ select test_new_booking('pending', 'over-2500') $$, 'over-2500 is accepted');
select lives_ok($$ select test_new_booking('pending', 'unsure') $$, 'unsure is accepted');
select throws_ok($$ select test_new_booking('pending', 'huge') $$, '23514', null, 'any other size is refused');
select throws_ok($$ select test_new_booking('pending', '') $$, '23514', null, 'an empty size is refused');
select throws_ok($$ select test_new_booking('pending', 'UNSURE') $$, '23514', null, 'the case matters');

-- An admin ---------------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000a1", "email": "admin@test.com", "app_metadata": {"role": "admin"}}';

select lives_ok(
         $$ insert into bookings (client_name, email, phone, service_type, frequency,
                                  address, city, zip, bedrooms, bathrooms, home_size,
                                  scheduled_date, time_slot, start_at, end_at)
            values ('By Office', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
                    '1 Main St', 'Syracuse', '13202', 2, 1, 'over-2500',
                    '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00') $$,
         'an admin can create a booking with a home size'
       );
select is((select home_size from bookings where client_name = 'By Office'), 'over-2500', 'and it is stored');

select is(
         set_booking_home_size((select pending from test_ids), 'over-2500') ->> 'status',
         'saved',
         'an admin can change a booking''s home size'
       );
select is((select home_size from bookings where id = (select pending from test_ids)), 'over-2500', 'and it is saved');
select results_eq(
         $$ select description, actor, action from activity_log
             where booking_id = (select pending from test_ids) and action = 'home_size_updated' $$,
         $$ values ('Home size set to 2,500 sq ft or more (was not sure) by admin@test.com'::text,
                    'admin@test.com'::text, 'home_size_updated'::text) $$,
         'the activity log says what it was, what it is now, and who did it'
       );

select is(set_booking_home_size((select pending from test_ids), 'over-2500') ->> 'status', 'unchanged', 'saving the same size again changes nothing');
select is(
         (select count(*) from activity_log where booking_id = (select pending from test_ids) and action = 'home_size_updated'),
         1::bigint,
         'and logs nothing new'
       );

select is(set_booking_home_size((select old_booking from test_ids), '1800-2500') ->> 'status', 'saved', 'a size can be set on a booking that had none');
select is(
         (select description from activity_log where booking_id = (select old_booking from test_ids) and action = 'home_size_updated'),
         'Home size set to 1,800 to 2,500 sq ft (it was not recorded) by admin@test.com',
         'and the log says it had not been recorded'
       );

select results_eq(
         $$ select set_booking_home_size((select done from test_ids), 'unsure') ->> 'status',
                   set_booking_home_size((select done from test_ids), 'unsure') -> 'booking_status' #>> '{}' $$,
         $$ values ('closed'::text, 'done'::text) $$,
         'a finished booking is refused, naming its status'
       );
select is(set_booking_home_size((select cancelled from test_ids), 'unsure') ->> 'status', 'closed', 'so is a cancelled one');
select results_eq(
         $$ select home_size from bookings where id in ((select done from test_ids), (select cancelled from test_ids)) order by home_size $$,
         $$ values ('over-2500'::text), ('under-1800'::text) $$,
         'and neither booking changed'
       );
select is(
         (select count(*) from activity_log where booking_id in ((select done from test_ids), (select cancelled from test_ids)) and action = 'home_size_updated'),
         0::bigint,
         'nor was anything logged for them'
       );

select is(set_booking_home_size('00000000-0000-0000-0000-00000000dead', 'unsure') ->> 'status', 'not_found', 'a booking that does not exist is reported');
select throws_ok($$ select set_booking_home_size((select pending from test_ids), null) $$, '22004', null, 'a save can never clear the size');
select throws_ok($$ select set_booking_home_size((select pending from test_ids), 'huge') $$, '23514', null, 'an unknown size is refused by the database');
select is((select home_size from bookings where id = (select pending from test_ids)), 'over-2500', 'and refused saves left the size as it was');

-- A customer ----------------------------------------------------------------------------------------

set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000c1", "email": "customer@test.com", "app_metadata": {"role": "customer"}}';

select throws_ok(
         $$ select set_booking_home_size((select pending from test_ids), 'under-1800') $$,
         '42501', null,
         'a customer cannot change a home size'
       );
-- A customer's direct update matches no row: row security hides every booking.
update bookings set home_size = 'under-1800';

reset role;
select is(
         (select count(*) from bookings where home_size = 'under-1800' and id = (select pending from test_ids)),
         0::bigint,
         'nor can a customer update one directly (row security hides every booking)'
       );

set local role authenticated;

-- Admin only in user_metadata (which a user can edit themselves) -----------------------------------------

set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000c1", "email": "customer@test.com", "user_metadata": {"role": "admin"}}';

select throws_ok(
         $$ select set_booking_home_size((select pending from test_ids), 'under-1800') $$,
         '42501', null,
         'an admin role in user_metadata grants nothing'
       );
select throws_ok(
         $$ insert into bookings (client_name, email, phone, service_type, frequency,
                                  address, city, zip, bedrooms, bathrooms, home_size,
                                  scheduled_date, time_slot, start_at, end_at)
            values ('Sneaky', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
                    '1 Main St', 'Syracuse', '13202', 2, 1, 'unsure',
                    '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00') $$,
         '42501', null,
         'nor insert a booking'
       );

-- An anonymous visitor ----------------------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
         $$ select set_booking_home_size((select pending from test_ids), 'under-1800') $$,
         '42501', null,
         'anon cannot change a home size'
       );
select throws_ok($$ select home_size from bookings $$, '42501', null, 'anon cannot read it');
select throws_ok($$ update bookings set home_size = 'unsure' $$, '42501', null, 'nor write it');

-- The public form writes through the service role -------------------------------------------------------------

reset role;
set local role service_role;
select lives_ok(
         $$ insert into bookings (client_name, email, phone, service_type, frequency,
                                  address, city, zip, bedrooms, bathrooms, home_size,
                                  scheduled_date, time_slot, start_at, end_at)
            values ('Public Form', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
                    '1 Main St', 'Syracuse', '13202', 2, 1, '1800-2500',
                    '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00') $$,
         'the public booking path can store a home size'
       );
select is(
         (select home_size from bookings where client_name = 'Public Form'),
         '1800-2500',
         'and it is saved'
       );

reset role;
select * from finish();
rollback;
