-- Customer accounts, plans and invoices
-- (supabase/migrations/20261110173445_customer_accounts.sql and
-- 20261110173448_customer_billing_and_plans.sql).
--
-- A signed-in customer reads only their own account's rows, nobody gets admin
-- access from a customer session or a user_metadata claim, records are claimed
-- by CONFIRMED email only, invitations work once and only for the invited
-- email, and invoices are written by admins and read-only for customers.
--
-- Run against the local stack (Docker): npx supabase start, then
-- npx supabase test db. Everything runs in one transaction and is rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(85);

-- Fixtures (as the table owner) ----------------------------------------------------------
-- alice  residential, one booking          bob   commercial owner, one quote + booking
-- carol  invited member of bob's account   dave  email not confirmed, has a booking
-- erin   residential, a different customer gina  signs up with nothing, joins bob later

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.com', now(), '{"name": "Alice Adams"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob@biz.com',    now(), '{"name": "Bob''s Bakery", "account_type": "commercial"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'carol@biz.com',  now(), '{"name": "Carol"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'dave@test.com',  null,  '{"name": "Dave"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'erin@test.com',  now(), '{"name": "Erin"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'gina@test.com',  now(), '{"name": "Gina"}');

create function test_new_booking(p_email text)
returns uuid
language sql
as $$
  insert into bookings (client_name, email, phone, service_type, frequency,
                        address, city, zip, bedrooms, bathrooms,
                        scheduled_date, time_slot, start_at, end_at)
  values ('Test Client', p_email, '(315) 555-0100', 'standard', 'bi-weekly',
          '1 Main St', 'Syracuse', '13202', 2, 1,
          '2026-12-02', 'morning', '2026-12-02 13:00+00', '2026-12-02 17:00+00')
  returning id;
$$;

-- How many rows a statement changed, run as whoever is signed in: RLS hides
-- other people's rows from an UPDATE instead of raising an error.
create function test_rows_changed(p_sql text)
returns bigint
language plpgsql
as $$
declare
  v_rows bigint;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

create table test_ids as
select test_new_booking('Alice@Test.com') as alice_booking,   -- mixed case on purpose
       test_new_booking('bob@biz.com')    as bob_booking,
       test_new_booking('carol@biz.com')  as carol_booking,
       test_new_booking('dave@test.com')  as dave_booking,
       test_new_booking('erin@test.com')  as erin_booking;

insert into commercial_quotes (business_name, contact_name, email, phone, facility_type, sqft_range,
                               address, city, zip, floors, service_areas, frequency)
values ('Bob''s Bakery', 'Bob', 'bob@biz.com', '(315) 555-0101', 'retail', '1k-2k',
        '9 Oak St', 'Syracuse', '13202', 1, array['restrooms'], 'weekly');

-- Staff-only rows a customer must never see.
insert into activity_log (booking_id, description)
select alice_booking, 'Staff note' from test_ids;
insert into booking_access (booking_id, instructions)
select alice_booking, 'Gate code 4412' from test_ids;

grant select on test_ids to anon, authenticated, service_role;

-- Not signed in ----------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok($$ select * from accounts $$, '42501', null, 'anon cannot read accounts');
select throws_ok($$ select claim_account_records() $$, '42501', null, 'anon cannot claim records');
select throws_ok($$ select * from invoices $$, '42501', null, 'anon cannot read invoices');

-- A user whose email isn't confirmed -------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000d1", "email": "dave@test.com"}';

select is(claim_account_records() ->> 'status', 'unverified',
          'an unconfirmed email claims nothing');
select is((select count(*) from accounts), 0::bigint, 'and gets no account');
select is((select count(*) from bookings), 0::bigint,
          'and cannot read the booking made with their email');

-- Alice: a residential customer ---------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000a1", "email": "alice@test.com"}';

select is((select count(*) from bookings), 0::bigint,
          'before claiming, a customer reads no bookings (the email alone grants nothing)');

select is(claim_account_records() ->> 'status', 'ok', 'a confirmed email can claim');
select is(claim_account_records() ->> 'role', 'owner', 'a new account makes the user its owner');
select is((select account_type from accounts), 'residential', 'the account is residential by default');
select is((select name from accounts), 'Alice Adams', 'and takes the name from signup');
select is((select count(*) from bookings), 1::bigint, 'the booking with her email (any case) is hers now');
select is((select (claim_account_records() ->> 'linked_bookings')::int), 0,
          'claiming again links nothing new');
select is((select count(*) from bookings where email = 'erin@test.com'), 0::bigint,
          'she cannot read another customer''s booking');
select is((select count(*) from commercial_quotes), 0::bigint, 'or a business''s quote request');

-- Staff-only data stays staff-only.
select is((select count(*) from activity_log), 0::bigint, 'she cannot read the activity log');
select is((select count(*) from booking_access), 0::bigint, 'or entry instructions');
select is((select count(*) from booking_employees), 0::bigint, 'or crew assignments');

-- She cannot change bookings, her own included.
select is(test_rows_changed($$ update bookings set status = 'cancelled' $$),
          0::bigint, 'a customer cannot update her booking');
select is(test_rows_changed($$ update bookings set account_id = null $$),
          0::bigint, 'or unlink it');
select throws_ok($$ insert into bookings (client_name) values ('x') $$, '42501', null,
                 'or insert one');
select throws_ok($$ delete from bookings $$, '42501', null, 'or delete one');

-- Her account: rename yes, restructure no.
select lives_ok($$ update accounts set name = 'Alice A.', phone = '(315) 555-0199' $$,
                'the owner can change the account name and phone');
select is((select name from accounts), 'Alice A.', 'the rename stuck');
select throws_ok($$ update accounts set account_type = 'commercial' $$, '42501', null,
                 'but not the account type');
select throws_ok($$ insert into accounts (account_type, name) values ('residential', 'x') $$,
                 '42501', null, 'and cannot create accounts directly');
select throws_ok($$ insert into account_members (account_id, user_id, role, email)
                    select id, '00000000-0000-0000-0000-0000000000e1', 'member', 'erin@test.com' from accounts $$,
                 '42501', null, 'or add members directly');
select throws_ok($$ select token_hash from account_invites $$, '42501', null,
                 'and cannot select an invite token hash');
select is(create_account_invite(repeat('a', 64), 'x@test.com') ->> 'status', 'not_commercial',
          'a residential account cannot invite anyone');

-- A user_metadata "admin" claim grants nothing.
reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000e1", "email": "erin@test.com",
    "user_metadata": {"role": "admin"}, "app_metadata": {}}';
select is((select count(*) from bookings), 0::bigint,
          'a user_metadata admin claim does not open bookings');
select is((select count(*) from accounts), 0::bigint, 'or accounts');

-- Bob: a commercial account with a team ---------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000b1", "email": "bob@biz.com"}';

select is(claim_account_records() ->> 'status', 'ok', 'a business owner claims too');
select is((select account_type from accounts), 'commercial', 'a commercial signup makes a commercial account');
select is((select (claim_account_records() ->> 'linked_quotes')::int), 0, 'the quote was linked on the first call');
select is((select count(*) from commercial_quotes), 1::bigint, 'he reads his quote request');
select is((select count(*) from bookings), 1::bigint, 'and his booking');

select throws_ok($$ select create_account_invite('not-a-hash', 'carol@biz.com') $$, '22023', null,
                 'an invite needs a SHA-256 hex token hash');
select is(create_account_invite(repeat('a', 64), 'not an email') ->> 'status', 'invalid_email',
          'an invite needs a real email');
select is(create_account_invite(repeat('a', 64), ' Carol@Biz.com ') ->> 'status', 'created',
          'the owner can invite a teammate');
select is((select count(*) from account_invites), 1::bigint, 'the owner lists pending invites');
select is((select email from account_invites), 'carol@biz.com', 'stored lower-cased and trimmed');
select is(create_account_invite(repeat('b', 64), 'carol@biz.com') ->> 'status', 'created',
          'inviting the same email again replaces the pending invite');
select is((select count(*) from account_invites), 1::bigint, 'leaving one');
select is(create_account_invite(repeat('c', 64), 'gina@test.com') ->> 'status', 'created',
          'a second invite');
select is(create_account_invite(repeat('d', 64), 'erin@test.com') ->> 'status', 'created',
          'a third, for someone who will use the wrong login');

-- Carol joins through her link -------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000c1", "email": "carol@biz.com"}';

select is((select count(*) from account_invites), 0::bigint, 'a non-member sees no invites');
select is(accept_account_invite(repeat('a', 64)) ->> 'status', 'invalid',
          'the replaced token no longer works');
select is(accept_account_invite(repeat('9', 64)) ->> 'status', 'invalid', 'nor does an unknown one');
select is(accept_account_invite(repeat('c', 64)) ->> 'status', 'wrong_email',
          'an invite for another email is refused');
select is(accept_account_invite(repeat('b', 64)) ->> 'status', 'joined', 'her own invite works');
select is(accept_account_invite(repeat('b', 64)) ->> 'status', 'invalid', 'once only');
select is((select count(*) from commercial_quotes), 1::bigint, 'a member reads the business''s quote requests');
select is((select count(*) from bookings), 1::bigint, 'and its bookings, not her own unclaimed one');
select is((select role from account_members where user_id = auth.uid()), 'member', 'as a member');
select is((select count(*) from account_members), 1::bigint, 'a member sees only their own membership row');
select is(create_account_invite(repeat('e', 64), 'x@biz.com') ->> 'status', 'not_owner',
          'a member cannot invite');
select is(claim_account_records() ->> 'role', 'member', 'claiming keeps a member a member');

-- Gina has an empty account of her own and joins by link ---------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000f1", "email": "gina@test.com"}';

select is(claim_account_records() ->> 'status', 'ok', 'gina gets an empty account first');
select is(accept_account_invite(repeat('c', 64)) ->> 'status', 'joined',
          'and still joins the business: an empty account of her own is dropped');
select is((select count(*) from account_members), 1::bigint, 'she belongs to one account');

-- Erin holds her own records, so she cannot be pulled into another account.
reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000e1", "email": "erin@test.com"}';
select is(claim_account_records() ->> 'status', 'ok', 'erin claims her booking');
select is(accept_account_invite(repeat('d', 64)) ->> 'status', 'already_in_account',
          'an account that holds records is never dropped to accept an invite');
select is((select count(*) from bookings), 1::bigint, 'and she still reads her own booking');

-- Bob manages the team --------------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000b1", "email": "bob@biz.com"}';

select is((select count(*) from account_members), 3::bigint, 'the owner sees the whole team');
select is(remove_account_member('00000000-0000-0000-0000-0000000000b1') ->> 'status', 'not_found',
          'an owner cannot be removed');
select is(remove_account_member('00000000-0000-0000-0000-0000000000e1') ->> 'status', 'not_found',
          'nor can someone on another account');
select is(remove_account_member('00000000-0000-0000-0000-0000000000c1') ->> 'status', 'removed',
          'a member can be removed');
select is(revoke_account_invite((select id from account_invites where email = 'erin@test.com')) ->> 'status',
          'revoked', 'a pending invite can be revoked');

-- Plans and invoices ------------------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "email": "admin@test.com", "app_metadata": {"role": "admin"}}';

select lives_ok($$ insert into service_plans (account_id, service_type, frequency, address, city, zip)
                   select account_id, 'standard', 'bi-weekly', '1 Main St', 'Syracuse', '13202'
                     from bookings where email ilike 'alice@test.com' $$,
                'an admin can create a service plan');
select lives_ok($$ insert into invoices (account_id, booking_id, amount_cents, description, due_on)
                   select account_id, id, 12500, 'Standard clean, Dec 2', '2026-12-20'
                     from bookings where email ilike 'alice@test.com' $$,
                'an admin can create an invoice for a visit');
-- created_by isn't granted to the API roles (20261112033836_invoice_column_grants),
-- so read it as the table owner, then carry on as the admin.
reset role;
select is((select created_by from invoices), 'admin@test.com', 'recording who made it');
set local role authenticated;
select throws_ok($$ insert into invoices (account_id, booking_id, amount_cents, description, due_on)
                    select a.account_id, b.id, 5000, 'Wrong account', '2026-12-20'
                      from bookings a, bookings b
                     where a.email ilike 'alice@test.com' and b.email = 'erin@test.com' $$,
                 '23514', null, 'an invoice cannot point at another account''s booking');
select throws_ok($$ update invoices set amount_cents = 1 $$, '42501', null,
                 'an issued invoice''s amount cannot be edited');
select throws_ok($$ update invoices set status = 'paid' $$, '23514', null,
                 'paid needs a paid-on date');
select lives_ok($$ update invoices set status = 'paid', paid_on = '2026-12-05', payment_note = 'Check #1042' $$,
                'an admin can mark an invoice paid');
select throws_ok($$ update invoices set status = 'void', paid_on = null $$, '23514', null,
                 'a paid invoice cannot jump to void');

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000a1", "email": "alice@test.com"}';

select is((select count(*) from service_plans), 1::bigint, 'the customer reads her plan');
select is((select count(*) from invoices), 1::bigint, 'and her invoice');
select is((select status from invoices), 'paid', 'with its status');
select throws_ok($$ insert into invoices (account_id, amount_cents, description, due_on)
                    select id, 100, 'Free money', '2026-12-31' from accounts $$,
                 '42501', null, 'a customer cannot create an invoice');
select is(test_rows_changed($$ update invoices set status = 'open', paid_on = null $$), 0::bigint,
          'or change one (RLS lets only admins update)');
select throws_ok($$ insert into service_plans (account_id, service_type, frequency, address, city, zip)
                    select id, 'standard', 'weekly', '1 Main St', 'Syracuse', '13202' from accounts $$,
                 '42501', null, 'or a plan');

reset role;
set local role authenticated;
set local request.jwt.claims to
  '{"role": "authenticated", "sub": "00000000-0000-0000-0000-0000000000e1", "email": "erin@test.com"}';

select is((select count(*) from invoices), 0::bigint, 'another customer cannot read her invoice');
select is((select count(*) from service_plans), 0::bigint, 'or her plan');

-- Accounts that hold an invoice are never deleted ---------------------------------------------------

reset role;
select throws_ok($$ delete from accounts where id = (select account_id from invoices) $$, '23503', null,
                 'an account with an invoice cannot be deleted');

select * from finish();
rollback;
