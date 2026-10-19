-- Half-bathrooms (backlog B42,
-- supabase/migrations/20261019225200_half_bathrooms.sql): bookings.bathrooms is
-- numeric(2,1), and its CHECK allows 1 to 5 in steps of 0.5 only.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

create function test_new_booking(p_bathrooms numeric)
returns uuid
language sql
as $$
  insert into bookings (client_name, email, phone, service_type, frequency,
                        address, city, zip, bedrooms, bathrooms,
                        scheduled_date, time_slot, start_at, end_at)
  values ('Test Client', 'client@test.com', '(315) 555-0100', 'standard', 'one-time',
          '1 Main St', 'Syracuse', '13202', 2, p_bathrooms,
          '2026-11-02', 'morning', '2026-11-02 13:00+00', '2026-11-02 17:00+00')
  returning id;
$$;

-- The column ------------------------------------------------------------------

select col_type_is('public', 'bookings', 'bathrooms', 'numeric(2,1)',
                   'bookings.bathrooms is numeric(2,1)');
select col_not_null('public', 'bookings', 'bathrooms', 'bookings.bathrooms is still required');

-- Every row already in the table satisfies the new CHECK: it was added
-- validated, not NOT VALID.
select ok(
         (select convalidated
            from pg_constraint
           where conrelid = 'public.bookings'::regclass
             and conname = 'bookings_bathrooms_check'),
         'bookings_bathrooms_check is validated against existing rows'
       );

-- Accepted: every half step from 1 to 5 ----------------------------------------

select lives_ok(format('select test_new_booking(%s)', v),
                format('%s bathrooms is accepted', v))
  from unnest(array[1, 1.5, 2, 2.5, 3, 4.5, 5]::numeric[]) v;

select is(
         (select bathrooms from bookings where id = test_new_booking(2.5)),
         2.5::numeric,
         '2.5 bathrooms is stored as 2.5'
       );

-- Refused ---------------------------------------------------------------------

select throws_ok(format('select test_new_booking(%s)', v),
                 '23514', null,
                 format('%s bathrooms is refused by the CHECK', v))
  from unnest(array[0, 0.5, 5.5, 1.3, 2.7]::numeric[]) v;

-- numeric(2,1) rounds to a tenth first: 1.25 becomes 1.3, still not a half step.
select throws_ok('select test_new_booking(1.25)', '23514', null,
                 '1.25 bathrooms (stored as 1.3) is refused by the CHECK');

-- Ten or more doesn't fit numeric(2,1) at all.
select throws_ok('select test_new_booking(10)', '22003', null,
                 '10 bathrooms overflows numeric(2,1)');

select * from finish();
rollback;
