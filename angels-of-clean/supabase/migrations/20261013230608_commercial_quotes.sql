-- Angels of Clean — commercial quote requests (backlog B3)
-- Run this once in the Supabase SQL Editor, after 002 (the policy below relies
-- on the admin role claim that 002 introduced).
--
-- The commercial flow used to end on a success screen without sending anything
-- to the server, so every lead was lost. Quote requests are now stored here by
-- submitCommercialQuote (service-role insert, like bookings) and listed for
-- admins at /admin/quotes.
--
-- Until this has been run, submitting a quote request shows the customer
-- "Something went wrong. Please try again." — it never claims success.

create table commercial_quotes (
  id                  uuid primary key default gen_random_uuid(),
  quote_number        integer generated always as identity (start with 1000) unique not null,
  business_name       text not null,
  contact_name        text not null,
  email               text not null,
  phone               text not null,
  facility_type       text not null check (facility_type in ('office', 'retail', 'medical', 'warehouse', 'school', 'restaurant')),
  sqft_range          text not null check (sqft_range in ('<1k', '1k-2k', '2k-5k', '5k+')),
  address             text not null,
  city                text not null,
  zip                 text not null,
  floors              smallint not null check (floors between 1 and 20),
  service_areas       text[] not null check (cardinality(service_areas) >= 1),
  frequency           text not null check (frequency in ('daily', '2-3x', 'weekly', 'bi-weekly', 'monthly', 'one-time')),
  schedule_preference text check (schedule_preference in ('before', 'during', 'after', 'weekends')),
  notes               text,
  submitted_at        timestamptz not null default now()
);
create index commercial_quotes_submitted_at_idx on commercial_quotes (submitted_at desc);

-- Row Level Security ----------------------------------------------------

alter table commercial_quotes enable row level security;

-- Admins read the list. Deliberately no insert/update/delete policy for any
-- role: customer inserts go through the service_role client, which bypasses RLS.
create policy "admin_select_commercial_quotes" on commercial_quotes
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
