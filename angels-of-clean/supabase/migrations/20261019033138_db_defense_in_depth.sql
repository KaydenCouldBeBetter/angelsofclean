-- Angels of Clean — make the database enforce what the app already validates
-- Defense in depth: the server actions (app/actions/submitBooking.ts,
-- submitCommercialQuote.ts) already check all of this, but anything that
-- reaches the table another way (a future code path, a bug, a hand-run
-- statement) should hit the same rules. Also trims the table privileges that
-- Supabase grants every API role by default down to what the app uses.
--
-- Checked before writing: the owner ran a read-only query on 2026-10-18 that
-- found no existing row breaking any of the constraints below.
--
-- After applying, run `npm run db:types` (commercial_quotes gains updated_at).

-- Length limits ----------------------------------------------------------
-- Must match FIELD_MAX_LENGTHS in lib/constants.ts;
-- supabase/__tests__/field-lengths.test.ts fails if they drift apart.
-- char_length counts characters, JavaScript's .length counts UTF-16 units, so
-- anything the app accepts always fits.

alter table bookings
  add constraint bookings_client_name_length check (char_length(client_name) <= 100),
  add constraint bookings_email_length       check (char_length(email) <= 254),
  add constraint bookings_phone_length       check (char_length(phone) <= 20),
  add constraint bookings_address_length     check (char_length(address) <= 200),
  add constraint bookings_city_length        check (char_length(city) <= 100),
  add constraint bookings_notes_length       check (char_length(notes) <= 1000);

alter table commercial_quotes
  add constraint commercial_quotes_business_name_length check (char_length(business_name) <= 100),
  add constraint commercial_quotes_contact_name_length  check (char_length(contact_name) <= 100),
  add constraint commercial_quotes_email_length         check (char_length(email) <= 254),
  add constraint commercial_quotes_phone_length         check (char_length(phone) <= 20),
  add constraint commercial_quotes_address_length       check (char_length(address) <= 200),
  add constraint commercial_quotes_city_length          check (char_length(city) <= 100),
  add constraint commercial_quotes_notes_length         check (char_length(notes) <= 1000);

-- Formats ----------------------------------------------------------------
-- The email shape is the actions' EMAIL_REGEX: something@something.something
-- with no spaces. Whether the ZIP is in the service area stays an app rule,
-- since that list changes.

alter table bookings
  add constraint bookings_zip_format   check (zip ~ '^[0-9]{5}$'),
  add constraint bookings_email_format check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  add constraint bookings_end_after_start check (end_at > start_at);

alter table commercial_quotes
  add constraint commercial_quotes_zip_format   check (zip ~ '^[0-9]{5}$'),
  add constraint commercial_quotes_email_format check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

-- updated_at -------------------------------------------------------------
-- The admin actions set bookings.updated_at by hand; the trigger keeps it
-- right for every other update too. Quotes get the column now so a future
-- "mark as contacted" has it; existing quotes start at their submit time.

alter table commercial_quotes
  add column updated_at timestamptz not null default now();
update commercial_quotes set updated_at = submitted_at;

create function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Only ever runs as a trigger; nobody needs to call it over the API.
revoke execute on function set_updated_at() from public, anon, authenticated;

create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

create trigger commercial_quotes_set_updated_at
  before update on commercial_quotes
  for each row execute function set_updated_at();

-- Privileges -------------------------------------------------------------
-- Supabase grants anon and authenticated every privilege on every table, so
-- only RLS stood between a signed-up customer account and the data, and RLS
-- doesn't apply to TRUNCATE at all. anon gets nothing: the public booking and
-- quote inserts and the rate limiter all use the service role.
-- authenticated keeps exactly what the admin pages and
-- assign_booking_employees (security invoker) use; RLS still requires the
-- admin role on every row.
-- activity_log is left as it is here (another change owns it).

revoke all on table bookings, employees, booking_employees, commercial_quotes, rate_limits
  from anon, authenticated;

-- Admin pages read and update bookings; assign_booking_employees locks the
-- row with select ... for update, which also needs UPDATE.
grant select, update on table bookings to authenticated;
-- Read for the roster and for the crew names assign_booking_employees returns.
grant select on table employees to authenticated;
-- Embedded in booking reads; assign_booking_employees inserts and deletes.
-- Nothing updates a row in place.
grant select, insert, delete on table booking_employees to authenticated;
-- The admin Quotes page only reads.
grant select on table commercial_quotes to authenticated;
-- rate_limits: nothing. check_rate_limit runs as the service role.

-- The identity sequences behind booking_number and quote_number. Only the
-- service role inserts those rows.
revoke all on all sequences in schema public from anon, authenticated;
