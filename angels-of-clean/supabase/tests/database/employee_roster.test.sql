-- Employee roster (supabase/migrations/20261113181527_employee_roster.sql):
-- only admins add, archive or reactivate employees; a phone number can't be on
-- two rows; nobody is ever deleted; archiving is refused while the employee is
-- on a job that hasn't ended; archived employees can't be added to a job; and
-- every change leaves an employee_history row.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

create function test_new_booking(p_start timestamptz, p_end timestamptz)
returns uuid
language sql
as $$
  insert into bookings (client_name, email, phone, service_type, frequency,
                        address, city, zip, bedrooms, bathrooms,
                        scheduled_date, time_slot, start_at, end_at, status)
  values ('Test Client', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
          '1 Main St', 'Syracuse', '13202', 2, 1,
          '2026-11-02', 'morning', p_start, p_end, 'confirmed')
  returning id;
$$;

create table test_ids as
select test_new_booking(now() + interval '1 day', now() + interval '1 day 4 hours') as upcoming,
       test_new_booking(now() + interval '3 days', now() + interval '3 days 4 hours') as other,
       test_new_booking(now() - interval '5 days', now() - interval '5 days' + interval '4 hours') as past;
grant select on test_ids to anon, authenticated;

-- A customer and an anonymous visitor ---------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "email": "customer@test.com", "app_metadata": {"role": "customer"}}';

select throws_ok(
         $$ select create_employee('Pat Q.', 'PQ', '(315) 555-0999', '2026-11-01') $$,
         '42501', null,
         'a non-admin cannot create an employee'
       );
select throws_ok(
         $$ select set_employee_archived((select id from employees limit 1), true) $$,
         '42501', null,
         'a non-admin cannot archive an employee'
       );
select throws_ok(
         $$ insert into employees (name, initials, phone, hired_date) values ('X', 'X', '315-555-0998', '2026-11-01') $$,
         '42501', null,
         'a non-admin cannot insert into employees directly'
       );

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok(
         $$ select create_employee('Pat Q.', 'PQ', '(315) 555-0999', '2026-11-01') $$,
         '42501', null,
         'anon cannot call create_employee'
       );

-- An admin ----------------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "email": "admin@test.com", "app_metadata": {"role": "admin"}}';

select is(
         (select create_employee('  Pat Q.  ', 'PQ', '(315) 555-0999', '2026-11-01') ->> 'status'),
         'created',
         'an admin can create an employee'
       );

select is(
         (select name from employees where phone = '(315) 555-0999'),
         'Pat Q.',
         'the name is trimmed'
       );

select is(
         (select archived_at from employees where phone = '(315) 555-0999'),
         null,
         'a new employee is active'
       );

select is(
         (select action || ' by ' || actor from employee_history
           where employee_id = (select id from employees where phone = '(315) 555-0999')),
         'hired by admin@test.com',
         'creating an employee records who hired them'
       );

select is(
         (select create_employee('Pat Again', 'PA', '315.555.0999', '2026-11-02') ->> 'status'),
         'duplicate_phone',
         'the same phone number in another format is a duplicate'
       );

select is(
         (select count(*)::int from employees where phone like '%555-0999' or phone like '%555.0999'),
         1,
         'a duplicate writes nothing'
       );

select throws_ok(
         $$ insert into employees (name, initials, phone, hired_date) values ('Dup', 'D', '3155550999', '2026-11-01') $$,
         '23505', null,
         'the unique index backs up the check, whatever the phone formatting'
       );

select throws_ok(
         $$ delete from employees where phone = '(315) 555-0999' $$,
         '42501', null,
         'nobody can delete an employee'
       );

-- Archiving -------------------------------------------------------------------------------------

select is(
         (select set_employee_archived((select id from employees where phone = '(315) 555-0999'), true) ->> 'status'),
         'archived',
         'an employee with no jobs can be archived'
       );

select isnt(
         (select archived_at from employees where phone = '(315) 555-0999'),
         null,
         'archiving sets archived_at'
       );

select is(
         (select set_employee_archived((select id from employees where phone = '(315) 555-0999'), true) ->> 'status'),
         'unchanged',
         'archiving twice changes nothing'
       );

-- An archived employee can't be put on a job.
select is(
         (select assign_booking_employees(
                   (select upcoming from test_ids),
                   array[(select id from employees where phone = '(315) 555-0999')],
                   '{}'::uuid[]) ->> 'status'),
         'archived',
         'an archived employee cannot be added to a job'
       );

select is(
         (select count(*)::int from booking_employees
           where employee_id = (select id from employees where phone = '(315) 555-0999')),
         0,
         'the refused assignment wrote nothing'
       );

-- Reactivating -------------------------------------------------------------------------------------

select is(
         (select set_employee_archived((select id from employees where phone = '(315) 555-0999'), false) ->> 'status'),
         'reactivated',
         'an archived employee can be reactivated'
       );

select is(
         (select string_agg(action, ',' order by created_at, action) from employee_history
           where employee_id = (select id from employees where phone = '(315) 555-0999')),
         'archived,hired,reactivated',
         'history keeps every change'
       );

-- Upcoming jobs block archiving ------------------------------------------------------------------------

select is(
         (select assign_booking_employees(
                   (select upcoming from test_ids),
                   array[(select id from employees where phone = '(315) 555-0999')],
                   '{}'::uuid[]) ->> 'status'),
         'saved',
         'an active employee can be assigned'
       );

select is(
         (select set_employee_archived((select id from employees where phone = '(315) 555-0999'), true) ->> 'status'),
         'has_upcoming',
         'an employee on an upcoming job cannot be archived'
       );

select is(
         (select archived_at from employees where phone = '(315) 555-0999'),
         null,
         'a refused archive leaves them active'
       );

-- A job that has already ended doesn't block it.
select lives_ok(
         $$ select assign_booking_employees(
              (select upcoming from test_ids), '{}'::uuid[],
              array[(select id from employees where phone = '(315) 555-0999')]) $$,
         'the employee can be taken off the upcoming job'
       );

select lives_ok(
         $$ select assign_booking_employees(
              (select past from test_ids),
              array[(select id from employees where phone = '(315) 555-0999')],
              '{}'::uuid[]) $$,
         'and put on a job that has already ended'
       );

select is(
         (select set_employee_archived((select id from employees where phone = '(315) 555-0999'), true) ->> 'status'),
         'archived',
         'a job that has already ended does not block archiving'
       );

select * from finish();
rollback;
