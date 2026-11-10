-- Angels of Clean — service plans and invoices for customer accounts
-- Apply after 20261110173445_customer_accounts.sql, then run `npm run db:types`.
--
-- service_plans  the recurring service an account has with us ("bi-weekly
--                standard clean at 12 Elm St"). Admin-managed; the customer
--                portal shows it beside the upcoming visits, which are ordinary
--                bookings (bookings.plan_id says which plan a visit belongs to).
-- invoices       what the office bills an account. Entered by an admin and
--                read-only for customers; nothing is paid online (owner
--                decision 2026-10-19, B28), so a customer sees the amount, the
--                due date and whether it has been marked paid.
--
-- Both are restricted to the account's members for reading and to admins for
-- writing, the same split as bookings. Deleting an account that has a plan or an
-- invoice is refused (ON DELETE RESTRICT); accept_account_invite relies on that.
--
-- Until this is applied, the portal's plan and billing pages fail to load.

-- service_plans --------------------------------------------------------------------

create table service_plans (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts (id) on delete restrict,
  -- 'commercial' is a janitorial service from an accepted quote, which has no
  -- residential-style service type.
  service_type text not null check (service_type in ('standard', 'deep', 'moveinout', 'commercial')),
  frequency    text not null check (frequency in ('daily', '2-3x', 'weekly', 'bi-weekly', 'monthly')),
  address      text not null,
  city         text not null,
  zip          text not null,
  status       text not null default 'active' check (status in ('active', 'paused', 'ended')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Must match FIELD_MAX_LENGTHS in lib/constants.ts (field-lengths.test.ts).
  constraint service_plans_address_length check (char_length(address) <= 200),
  constraint service_plans_city_length check (char_length(city) <= 100),
  constraint service_plans_notes_length check (char_length(notes) <= 1000),
  constraint service_plans_zip_format check (zip ~ '^\d{5}$')
);

create index service_plans_account_id_idx on service_plans (account_id);

comment on table service_plans is 'Recurring service an account has with the company. Admin-managed; customers read their own.';

create trigger service_plans_set_updated_at
  before update on service_plans
  for each row execute function set_updated_at();

alter table bookings
  add column plan_id uuid references service_plans (id) on delete set null;
create index bookings_plan_id_idx on bookings (plan_id);

-- invoices ---------------------------------------------------------------------------

create table invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number integer generated always as identity (start with 1000) unique not null,
  account_id     uuid not null references accounts (id) on delete restrict,
  -- What it bills for, when it is one specific visit or quote. Both null for a
  -- general charge.
  booking_id     uuid references bookings (id) on delete restrict,
  quote_id       uuid references commercial_quotes (id) on delete restrict,
  -- Whole cents, never a float.
  amount_cents   integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  description    text not null,
  issued_on      date not null default ((now() at time zone 'America/New_York')::date),
  due_on         date not null,
  status         text not null default 'open' check (status in ('open', 'paid', 'void')),
  paid_on        date,
  payment_note   text,
  created_by     text default (auth.jwt() ->> 'email'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Invoice text isn't one of the customer-typed FIELD_MAX_LENGTHS fields, so
  -- the limits are written as ranges (see field-lengths.test.ts).
  constraint invoices_description_range check (char_length(description) between 1 and 200 and btrim(description) <> ''),
  constraint invoices_payment_note_range check (payment_note is null or char_length(payment_note) between 1 and 200),
  constraint invoices_due_after_issue check (due_on >= issued_on),
  -- A paid invoice says when; the others don't.
  constraint invoices_paid_on_matches_status check ((status = 'paid') = (paid_on is not null)),
  constraint invoices_one_subject check (booking_id is null or quote_id is null)
);

create index invoices_account_id_idx on invoices (account_id, issued_on desc);

comment on table invoices is 'Invoices the office entered for an account. Read-only for customers; no online payment.';
comment on column invoices.amount_cents is 'Whole US cents (12500 = $125.00).';

create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- The invoice's booking or quote must belong to the invoice's account, and an
-- invoice's status follows one flow: open -> paid | void, and paid -> open (to
-- undo a mistake). void is final.
create function enforce_invoice_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.booking_id is not null and not exists (
         select 1 from bookings b
          where b.id = new.booking_id and b.account_id = new.account_id) then
      raise exception 'invoice booking belongs to another account'
        using errcode = '23514';
    end if;
    if new.quote_id is not null and not exists (
         select 1 from commercial_quotes q
          where q.id = new.quote_id and q.account_id = new.account_id) then
      raise exception 'invoice quote belongs to another account'
        using errcode = '23514';
    end if;
  elsif new.status is distinct from old.status then
    if old.status = 'void'
       or (old.status = 'open' and new.status not in ('paid', 'void'))
       or (old.status = 'paid' and new.status <> 'open') then
      raise exception 'invoice status cannot change from % to %', old.status, new.status
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function enforce_invoice_rules() from public, anon, authenticated;

create trigger invoices_enforce_rules
  before insert or update on invoices
  for each row execute function enforce_invoice_rules();

-- Row Level Security -------------------------------------------------------------------

alter table service_plans enable row level security;
alter table invoices enable row level security;

create policy "customer_select_service_plans" on service_plans
  for select
  using (private.is_account_member(account_id));

create policy "admin_select_service_plans" on service_plans
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_insert_service_plans" on service_plans
  for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_update_service_plans" on service_plans
  for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "customer_select_invoices" on invoices
  for select
  using (private.is_account_member(account_id));

create policy "admin_select_invoices" on invoices
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_insert_invoices" on invoices
  for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_update_invoices" on invoices
  for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No delete policy or grant on either table: a plan ends, an invoice is voided.

-- Privileges ----------------------------------------------------------------------------

revoke all on table service_plans, invoices from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on table service_plans, invoices to authenticated;

-- Admins create a plan and edit what it says, but can't move it to another account.
grant insert (account_id, service_type, frequency, address, city, zip, status, notes)
  on table service_plans to authenticated;
grant update (service_type, frequency, address, city, zip, status, notes)
  on table service_plans to authenticated;

-- An issued invoice's amount, account and subject are fixed; admins fix the due
-- date or description, mark it paid or void, and note how it was paid.
grant insert (account_id, booking_id, quote_id, amount_cents, description, issued_on, due_on)
  on table invoices to authenticated;
grant update (description, due_on, status, paid_on, payment_note)
  on table invoices to authenticated;
