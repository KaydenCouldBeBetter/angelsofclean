-- Which invoice columns a signed-in user can read (submission check S2).
-- invoices.created_by holds the email of the admin who entered the invoice.
-- The portal never shows it, and a customer must not be able to read it
-- through the API either. Everything a customer page needs stays readable.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a5a1', 'pat@test.com', now());
insert into accounts (id, account_type, name) values
  ('00000000-0000-0000-0000-00000000a5a2', 'residential', 'Pat');
insert into account_members (account_id, user_id, role, email) values
  ('00000000-0000-0000-0000-00000000a5a2', '00000000-0000-0000-0000-00000000a5a1', 'owner', 'pat@test.com');
insert into invoices (account_id, amount_cents, description, due_on, created_by) values
  ('00000000-0000-0000-0000-00000000a5a2', 9900, 'Deep clean', current_date + 7, 'staff@test.com');

set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-00000000a5a1", "email": "pat@test.com"}';

select is((select count(*) from invoices), 1::bigint, 'the customer still sees their invoice');

select lives_ok(
  $$ select id, invoice_number, account_id, booking_id, quote_id, amount_cents, description,
            issued_on, due_on, status, paid_on, payment_note, created_at, updated_at
       from invoices $$,
  'every column the portal reads is still readable');

select throws_ok($$ select created_by from invoices $$, '42501', null,
                 'a customer cannot read which admin entered the invoice');

select throws_ok($$ select * from invoices $$, '42501', null,
                 'nor through select *');

select * from finish();
rollback;
