-- Angels of Clean — initial schema for bookings + admin panel
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).

create type booking_status as enum ('pending', 'confirmed', 'active', 'done', 'cancelled');

create table employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  initials    text not null,
  phone       text not null,
  hired_date  date not null,
  created_at  timestamptz not null default now()
);

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  booking_number integer generated always as identity (start with 1000) unique not null,
  client_name    text not null,
  email          text not null,
  phone          text not null,
  service_type   text not null check (service_type in ('standard', 'deep', 'moveinout')),
  frequency      text not null check (frequency in ('one-time', 'weekly', 'bi-weekly', 'monthly')),
  address        text not null,
  city           text not null,
  zip            text not null,
  bedrooms       smallint not null check (bedrooms between 1 and 5),
  bathrooms      smallint not null check (bathrooms between 1 and 5),
  notes          text,
  scheduled_date date not null,
  time_slot      text not null check (time_slot in ('morning', 'afternoon')),
  start_at       timestamptz not null,
  end_at         timestamptz not null,
  status         booking_status not null default 'pending',
  submitted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index bookings_start_at_idx on bookings (start_at);

create table booking_employees (
  booking_id  uuid not null references bookings(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (booking_id, employee_id)
);
create index booking_employees_employee_idx on booking_employees (employee_id);

create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  description text not null,
  created_at  timestamptz not null default now()
);
create index activity_log_booking_idx on activity_log (booking_id);

-- Row Level Security ----------------------------------------------------

alter table bookings          enable row level security;
alter table employees         enable row level security;
alter table booking_employees enable row level security;
alter table activity_log      enable row level security;

create policy "admin_select_bookings" on bookings
  for select using (auth.role() = 'authenticated');
create policy "admin_update_bookings" on bookings
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- Deliberately no insert/delete policy on bookings for any role.
-- Customer inserts go through the service_role client in submitBooking.ts, which bypasses RLS.

create policy "admin_select_employees" on employees
  for select using (auth.role() = 'authenticated');

create policy "admin_all_booking_employees" on booking_employees
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin_all_activity_log" on activity_log
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Seed data ---------------------------------------------------------------
-- Real employee roster, reused from app/admin/data/mock.ts.
-- No booking rows are seeded — mock jobs are dated April 2026 and already stale;
-- the admin panel starts empty until real customers book through /residential.

insert into employees (name, initials, phone, hired_date) values
  ('Marcus T.', 'MT', '(315) 555-0142', '2024-03-01'),
  ('Ana V.',    'AV', '(315) 555-0187', '2024-06-01'),
  ('Rosa C.',   'RC', '(315) 555-0231', '2024-01-01'),
  ('Devon M.',  'DM', '(315) 555-0309', '2024-08-01'),
  ('Lisa P.',   'LP', '(315) 555-0264', '2024-11-01');
