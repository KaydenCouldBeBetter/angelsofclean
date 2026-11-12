-- Demo data for the LOCAL Supabase stack only.
--
-- `npx supabase db reset` runs this file after the migrations. `supabase db push`
-- never runs it, so it cannot reach a hosted project. Do not paste it into a
-- hosted project's SQL editor: it creates accounts with publicly known passwords.
--
-- Everything below is invented: names, addresses, phone numbers (555-01xx) and
-- email addresses (example.com). Dates are relative to today (New York time) so
-- the calendar always has upcoming work in it.
--
-- Demo logins (password for all three: DemoPass-2026!)
--   admin     demo-admin@example.com      sign in at /admin
--   customer  demo-customer@example.com   sign in at /login   (residential account)
--   business  demo-business@example.com   sign in at /login   (commercial account, team owner)
--
-- The five sample employees come from the initial schema migration.

-- Users ------------------------------------------------------------------------
-- Inserted straight into auth.users with a bcrypt password and a confirmed email,
-- plus the matching auth.identities row so password sign-in works locally.
-- The admin role lives in app_metadata, the same place the app and RLS read it.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'demo-admin@example.com',
   extensions.crypt('DemoPass-2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
   '{"name":"Demo Admin"}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'demo-customer@example.com',
   extensions.crypt('DemoPass-2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"Alice Adams","account_type":"residential"}'::jsonb, now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'demo-business@example.com',
   extensions.crypt('DemoPass-2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"name":"Northside Dental Group","account_type":"commercial"}'::jsonb, now(), now(), '', '', '', '', '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select u.id, u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
  from auth.users u
 where u.email in ('demo-admin@example.com', 'demo-customer@example.com', 'demo-business@example.com');

-- Accounts ---------------------------------------------------------------------
insert into accounts (id, account_type, name, phone) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'residential', 'Alice Adams', '(315) 555-0100'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'commercial', 'Northside Dental Group', '(315) 555-0150');

insert into account_members (account_id, user_id, role, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'owner', 'demo-customer@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'owner', 'demo-business@example.com');

-- Bookings ---------------------------------------------------------------------
-- (offset in days from today, slot, status, ...). Past visits are done; the next
-- few days are confirmed or pending so the dashboard and calendar have work.
with today as (select (now() at time zone 'America/New_York')::date as d),
rows(n, day_offset, slot, status, client, email, phone, service, freq, address, city, zip, beds, baths, account_id, notes) as (
  values
  (1, -21, 'morning',   'done',      'Alice Adams',   'demo-customer@example.com', '(315) 555-0100', 'standard',  'bi-weekly', '14 Maple St',  'Syracuse',   '13203', 3, 2.0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'Please use the side door.'),
  (2,  -7, 'morning',   'done',      'Alice Adams',   'demo-customer@example.com', '(315) 555-0100', 'standard',  'bi-weekly', '14 Maple St',  'Syracuse',   '13203', 3, 2.0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, null),
  (3,   0, 'afternoon', 'active',    'Priya Raman',   'priya.raman@example.com',   '(315) 555-0101', 'deep',      'one-time',  '88 Erie Blvd', 'Syracuse',   '13202', 2, 1.5, null, 'Heavy kitchen build-up.'),
  (4,   1, 'morning',   'confirmed', 'Alice Adams',   'demo-customer@example.com', '(315) 555-0100', 'standard',  'bi-weekly', '14 Maple St',  'Syracuse',   '13203', 3, 2.0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, null),
  (5,   1, 'afternoon', 'confirmed', 'Marcus Webb',   'marcus.webb@example.com',   '(315) 555-0102', 'standard',  'weekly',    '22 Pine Ave',  'Liverpool',  '13088', 4, 2.5, null, null),
  (6,   2, 'morning',   'pending',   'Dana Fischer',  'dana.fischer@example.com',  '(315) 555-0103', 'moveinout', 'one-time',  '47 Elm Dr',    'Cicero',     '13039', 3, 2.0, null, 'Keys with the building manager.'),
  (7,   3, 'afternoon', 'confirmed', 'Tom Alvarez',   'tom.alvarez@example.com',   '(315) 555-0104', 'deep',      'monthly',   '33 Cedar Rd',  'Camillus',   '13031', 3, 1.0, null, null),
  (8,   4, 'morning',   'pending',   'Grace Okafor',  'grace.okafor@example.com',  '(315) 555-0105', 'standard',  'weekly',    '101 Court St', 'Syracuse',   '13202', 2, 1.0, null, 'Two cats.'),
  (9,   6, 'morning',   'confirmed', 'Alice Adams',   'demo-customer@example.com', '(315) 555-0100', 'standard',  'bi-weekly', '14 Maple St',  'Syracuse',   '13203', 3, 2.0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, null),
  (10, -3, 'afternoon', 'cancelled', 'Leo Nakamura',  'leo.nakamura@example.com',  '(315) 555-0106', 'standard',  'one-time',  '12 Elm St',    'Baldwinsville', '13027', 2, 1.0, null, null)
)
insert into bookings (
  client_name, email, phone, service_type, frequency, address, city, zip,
  bedrooms, bathrooms, notes, scheduled_date, time_slot, start_at, end_at,
  status, account_id, submitted_at
)
select r.client, r.email, r.phone, r.service, r.freq, r.address, r.city, r.zip,
       r.beds, r.baths, r.notes,
       t.d + r.day_offset, r.slot,
       ((t.d + r.day_offset) + case r.slot when 'morning' then time '08:00' else time '12:00' end) at time zone 'America/New_York',
       ((t.d + r.day_offset) + case r.slot when 'morning' then time '12:00' else time '16:00' end) at time zone 'America/New_York',
       r.status::booking_status, r.account_id, now() - interval '2 days'
  from rows r, today t
 order by r.n;

-- Crews: assign the sample employees to the confirmed and active visits.
insert into booking_employees (booking_id, employee_id)
select b.id, e.id
  from (values
         ('Priya Raman',  'Marcus T.'), ('Priya Raman',  'Ana V.'),
         ('Marcus Webb',  'Rosa C.'),
         ('Tom Alvarez',  'Devon M.'),
         ('Alice Adams',  'Lisa P.')
       ) as pick(client, employee)
  join bookings  b on b.client_name = pick.client and b.status in ('confirmed', 'active')
  join employees e on e.name = pick.employee
on conflict do nothing;

-- A few activity entries so the booking detail pages are not empty.
insert into activity_log (booking_id, description, actor, action)
select b.id, 'Booking request received', null, 'submitted'
  from bookings b
 where b.status <> 'cancelled';

-- Entry instructions are kept apart from bookings (admin-only).
insert into booking_access (booking_id, instructions)
select b.id, 'Gate code 0000 (demo). Dog is friendly.'
  from bookings b
 where b.client_name = 'Marcus Webb';

-- Commercial: one quote request, linked to the business account ------------------
insert into commercial_quotes (
  business_name, contact_name, email, phone, facility_type, sqft_range, address, city, zip,
  floors, service_areas, frequency, schedule_preference, notes, account_id
) values
  ('Northside Dental Group', 'Jordan Reyes', 'demo-business@example.com', '(315) 555-0150',
   'medical', '2k-5k', '200 State St', 'Syracuse', '13202', 2,
   array['restrooms', 'reception', 'floors'], '2-3x', 'after',
   'Evening cleaning after patients leave.', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  ('Cedar Street Cafe', 'Sam Ortiz', 'sam.ortiz@example.com', '(315) 555-0151',
   'restaurant', '1k-2k', '9 Cedar St', 'Syracuse', '13204', 1,
   array['kitchen', 'floors'], 'weekly', 'before',
   null, null);

-- Plans and invoices for the customer portal ------------------------------------
insert into service_plans (account_id, service_type, frequency, address, city, zip, status, notes) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'standard', 'bi-weekly', '14 Maple St', 'Syracuse', '13203', 'active', 'Every other Tuesday morning.'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'commercial', '2-3x', '200 State St', 'Syracuse', '13202', 'active', 'After-hours janitorial.');

insert into invoices (account_id, amount_cents, description, issued_on, due_on, status, paid_on, payment_note)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 14500, 'Standard clean, 14 Maple St',
       t.d - 21, t.d - 7, 'paid', t.d - 10, 'Paid by check (demo)'
  from (select (now() at time zone 'America/New_York')::date as d) t
union all
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 14500, 'Standard clean, 14 Maple St',
       t.d - 7, t.d + 7, 'open', null, null
  from (select (now() at time zone 'America/New_York')::date as d) t
union all
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 62000, 'Janitorial service, October',
       t.d - 30, t.d - 15, 'open', null, null
  from (select (now() at time zone 'America/New_York')::date as d) t;
