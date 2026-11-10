-- Angels of Clean — customer accounts (residential and commercial)
-- Apply after 20261019225200_half_bathrooms.sql, then run `npm run db:types`.
--
-- Public signups are on, so any visitor can hold a signed-in session. Nothing
-- here makes a customer an admin: admin access still needs the server-set
-- app_metadata.role = 'admin' claim in every policy that grants it. What this
-- adds is a second, separate kind of access: a signed-in user may read only the
-- rows that belong to the account they are a member of.
--
-- Model
--   accounts         one per household or business (account_type)
--   account_members  who belongs to it (one account per user in v1). A
--                    residential account has one owner; a commercial account
--                    has an owner and any number of invited members.
--   account_invites  pending invitations. Only a SHA-256 hash of the token is
--                    stored and no customer can select it; the owner copies the
--                    link and sends it themselves (there is no outbound email
--                    until the app has a domain).
--   bookings.account_id, commercial_quotes.account_id
--                    which account a record belongs to; null until claimed.
--
-- Linking records to an account
--   claim_account_records() links bookings and quote requests whose email
--   matches the signed-in user's email, but ONLY once Supabase Auth has
--   confirmed that email (auth.users.email_confirmed_at). Without that check,
--   anyone could sign up with a victim's address and read their bookings.
--   Turn on "Confirm email" in the Supabase dashboard (Authentication ->
--   Providers -> Email) before real customers use this. Only an account's
--   owner claims by email; invited members see what the owner's account holds.
--
-- Until this is applied, the portal's pages fail to load their data.

-- Tables ---------------------------------------------------------------------------

create table accounts (
  id           uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('residential', 'commercial')),
  -- The customer's name (residential) or the business name (commercial).
  name         text not null,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Must match FIELD_MAX_LENGTHS.businessName / .phone in lib/constants.ts;
  -- supabase/__tests__/field-lengths.test.ts fails if they drift apart.
  constraint accounts_name_length check (char_length(name) <= 100),
  constraint accounts_name_not_blank check (btrim(name) <> ''),
  constraint accounts_phone_length check (char_length(phone) <= 20)
);

comment on table accounts is 'A household or business that customers sign in to. Records link to it through account_id.';

create trigger accounts_set_updated_at
  before update on accounts
  for each row execute function set_updated_at();

create table account_members (
  account_id uuid not null references accounts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('owner', 'member')),
  -- Copied from auth.users when the row is made, so the owner can list the
  -- team without any access to auth.users.
  email      text not null,
  created_at timestamptz not null default now(),
  primary key (account_id, user_id),
  -- One account per user in v1.
  constraint account_members_one_account_per_user unique (user_id),
  constraint account_members_email_length check (char_length(email) <= 254)
);

comment on table account_members is 'Which users belong to which account. Written only by the SECURITY DEFINER functions in this migration.';

create table account_invites (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,
  email       text not null,
  -- SHA-256 hex of the token in the invite link. The token itself is never stored.
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint account_invites_email_length check (char_length(email) <= 254)
);

create index account_invites_account_id_idx on account_invites (account_id);

comment on table account_invites is 'Pending invitations to a commercial account. token_hash is never readable through the API.';

-- Which account a booking or quote request belongs to ------------------------------

alter table bookings
  add column account_id uuid references accounts (id) on delete set null;
alter table commercial_quotes
  add column account_id uuid references accounts (id) on delete set null;

create index bookings_account_id_idx on bookings (account_id);
create index commercial_quotes_account_id_idx on commercial_quotes (account_id);

-- claim_account_records matches on these; unclaimed rows are the only ones scanned.
create index bookings_unclaimed_email_idx on bookings (lower(email)) where account_id is null;
create index commercial_quotes_unclaimed_email_idx on commercial_quotes (lower(email)) where account_id is null;

-- Helpers used by the policies -------------------------------------------------------
--
-- SECURITY DEFINER so they can read account_members without that table's own
-- policy calling itself. They live in the private schema, which PostgREST
-- doesn't expose, so nobody can call them over /rpc; authenticated keeps
-- EXECUTE because the policies run as the caller.

create function private.is_account_member(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
      from account_members m
     where m.account_id = p_account_id
       and m.user_id = (select auth.uid())
  );
$$;

create function private.is_account_owner(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
      from account_members m
     where m.account_id = p_account_id
       and m.user_id = (select auth.uid())
       and m.role = 'owner'
  );
$$;

revoke execute on function private.is_account_member(uuid), private.is_account_owner(uuid)
  from public, anon;
grant execute on function private.is_account_member(uuid), private.is_account_owner(uuid)
  to authenticated;

-- Row Level Security ----------------------------------------------------------------

alter table accounts enable row level security;
alter table account_members enable row level security;
alter table account_invites enable row level security;

-- accounts: members read their own; the owner may rename it; admins read all.
create policy "customer_select_accounts" on accounts
  for select
  using (private.is_account_member(id));

create policy "admin_select_accounts" on accounts
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "owner_update_accounts" on accounts
  for update
  using (private.is_account_owner(id))
  with check (private.is_account_owner(id));

-- account_members: you see your own row; an owner sees the whole team. No
-- insert, update or delete policy: the functions below are the only writers.
create policy "customer_select_account_members" on account_members
  for select
  using (user_id = (select auth.uid()) or private.is_account_owner(account_id));

create policy "admin_select_account_members" on account_members
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- account_invites: the owner lists pending invites (the token_hash column is
-- not granted below); admins read all.
create policy "owner_select_account_invites" on account_invites
  for select
  using (private.is_account_owner(account_id));

create policy "admin_select_account_invites" on account_invites
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Customers read the records that belong to their account, and nothing else.
-- The admin policies on both tables are unchanged. activity_log,
-- booking_access and booking_employees keep their admin-only policies, so a
-- customer sees no staff notes, door codes or crew.
create policy "customer_select_bookings" on bookings
  for select
  using (account_id is not null and private.is_account_member(account_id));

create policy "customer_select_commercial_quotes" on commercial_quotes
  for select
  using (account_id is not null and private.is_account_member(account_id));

-- Privileges ---------------------------------------------------------------------------
-- Same approach as 20261019033138: anon gets nothing, authenticated gets what
-- the portal uses, and RLS still decides which rows.

revoke all on table accounts, account_members, account_invites from anon, authenticated;

grant select on table accounts to authenticated;
-- The owner changes only the name and phone; the policy requires ownership.
grant update (name, phone) on table accounts to authenticated;
grant select on table account_members to authenticated;
-- No token_hash: `select *` on this table is refused, so queries name columns.
grant select (id, account_id, email, expires_at, accepted_at, created_at)
  on table account_invites to authenticated;

-- claim_account_records ---------------------------------------------------------------
--
-- Called by the portal after sign-in. Idempotent. Creates the caller's account
-- if they have none (type and name come from their signup metadata, which only
-- chooses a label: records are matched by email, never by that metadata), then,
-- for an owner, links unclaimed bookings and quote requests with the same email.
--
-- Return value (jsonb), by "status":
--   unverified — the user's email isn't confirmed yet; nothing was done
--   ok         — account_id, role, linked_bookings, linked_quotes

create function claim_account_records()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_meta      jsonb;
  v_account   uuid;
  v_role      text;
  v_type      text;
  v_name      text;
  v_bookings  integer := 0;
  v_quotes    integer := 0;
begin
  if v_uid is null then
    raise exception 'claim_account_records: sign-in required'
      using errcode = '42501';
  end if;

  select lower(u.email), u.email_confirmed_at, u.raw_user_meta_data
    into v_email, v_confirmed, v_meta
    from auth.users u
   where u.id = v_uid;

  if v_email is null or v_confirmed is null then
    return jsonb_build_object('status', 'unverified');
  end if;

  select m.account_id, m.role into v_account, v_role
    from account_members m
   where m.user_id = v_uid;

  if v_account is null then
    v_type := case when v_meta ->> 'account_type' = 'commercial'
                   then 'commercial' else 'residential' end;
    v_name := left(btrim(coalesce(nullif(btrim(v_meta ->> 'name'), ''), v_email)), 100);

    insert into accounts (account_type, name)
    values (v_type, v_name)
    returning id into v_account;

    insert into account_members (account_id, user_id, role, email)
    values (v_account, v_uid, 'owner', v_email)
    on conflict (user_id) do nothing;

    if found then
      v_role := 'owner';
    else
      -- A parallel call made the account first; use that one.
      delete from accounts where id = v_account;
      select m.account_id, m.role into v_account, v_role
        from account_members m
       where m.user_id = v_uid;
    end if;
  end if;

  if v_role = 'owner' then
    update bookings
       set account_id = v_account
     where account_id is null
       and lower(email) = v_email;
    get diagnostics v_bookings = row_count;

    update commercial_quotes
       set account_id = v_account
     where account_id is null
       and lower(email) = v_email;
    get diagnostics v_quotes = row_count;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'account_id', v_account,
    'role', v_role,
    'linked_bookings', v_bookings,
    'linked_quotes', v_quotes
  );
end;
$$;

revoke execute on function claim_account_records() from public, anon;
grant execute on function claim_account_records() to authenticated;

-- Invitations ---------------------------------------------------------------------------
--
-- The app makes a random token, keeps it only in the link it shows the owner,
-- and passes the database its SHA-256 hex (token_hash).

-- create_account_invite(p_token_hash, p_email)
-- Return value (jsonb), by "status":
--   created        — invite_id, expires_at
--   not_owner      — the caller doesn't own an account
--   not_commercial — only commercial accounts invite people
--   invalid_email
--   already_member — that email is already on the team
--   too_many       — 20 pending invites already
-- A new invite for the same email replaces the pending one. Invites last 7 days.

create function create_account_invite(p_token_hash text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid     uuid := auth.uid();
  v_account uuid;
  v_type    text;
  v_email   text := lower(btrim(p_email));
  v_id      uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_uid is null then
    raise exception 'create_account_invite: sign-in required'
      using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'create_account_invite: bad token hash'
      using errcode = '22023';
  end if;

  select a.id, a.account_type into v_account, v_type
    from account_members m
    join accounts a on a.id = m.account_id
   where m.user_id = v_uid
     and m.role = 'owner';

  if v_account is null then
    return jsonb_build_object('status', 'not_owner');
  end if;
  if v_type <> 'commercial' then
    return jsonb_build_object('status', 'not_commercial');
  end if;

  if v_email is null or char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('status', 'invalid_email');
  end if;

  perform 1 from account_members
   where account_id = v_account and lower(email) = v_email;
  if found then
    return jsonb_build_object('status', 'already_member');
  end if;

  delete from account_invites
   where account_id = v_account
     and lower(email) = v_email
     and accepted_at is null;

  if (select count(*) from account_invites
       where account_id = v_account
         and accepted_at is null
         and expires_at > now()) >= 20 then
    return jsonb_build_object('status', 'too_many');
  end if;

  insert into account_invites (account_id, email, token_hash, expires_at, created_by)
  values (v_account, v_email, p_token_hash, v_expires, v_uid)
  returning id into v_id;

  return jsonb_build_object('status', 'created', 'invite_id', v_id, 'expires_at', v_expires);
end;
$$;

-- accept_account_invite(p_token_hash)
-- Return value (jsonb), by "status":
--   joined             — account_id
--   unverified         — the caller's email isn't confirmed
--   invalid            — unknown, used or expired (never says which)
--   wrong_email        — the invite was issued to a different email
--   already_member     — already on this account
--   already_in_account — on another account that holds records
-- A user whose own account is still empty (they signed up first and it was
-- created automatically) leaves it and joins; one that holds records, plans or
-- invoices is never deleted.

create function accept_account_invite(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_confirmed timestamptz;
  v_inv       account_invites%rowtype;
  v_cur       uuid;
  v_cur_role  text;
begin
  if v_uid is null then
    raise exception 'accept_account_invite: sign-in required'
      using errcode = '42501';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
    from auth.users u
   where u.id = v_uid;
  if v_email is null or v_confirmed is null then
    return jsonb_build_object('status', 'unverified');
  end if;

  select * into v_inv
    from account_invites
   where token_hash = p_token_hash
     and accepted_at is null
     and expires_at > now()
     for update;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if lower(v_inv.email) <> v_email then
    return jsonb_build_object('status', 'wrong_email');
  end if;

  select m.account_id, m.role into v_cur, v_cur_role
    from account_members m
   where m.user_id = v_uid;

  if v_cur = v_inv.account_id then
    return jsonb_build_object('status', 'already_member');
  end if;

  if v_cur is not null then
    -- Only a sole-owner account that nothing references can be dropped.
    -- bookings and commercial_quotes would merely be unlinked by the delete, so
    -- they are checked here; the plans and invoices added next use ON DELETE
    -- RESTRICT, and their foreign key refuses the delete.
    if v_cur_role = 'owner'
       and (select count(*) from account_members where account_id = v_cur) = 1
       and not exists (select 1 from bookings where account_id = v_cur)
       and not exists (select 1 from commercial_quotes where account_id = v_cur) then
      begin
        delete from accounts where id = v_cur;
      exception when foreign_key_violation then
        return jsonb_build_object('status', 'already_in_account');
      end;
    else
      return jsonb_build_object('status', 'already_in_account');
    end if;
  end if;

  insert into account_members (account_id, user_id, role, email)
  values (v_inv.account_id, v_uid, 'member', v_email);

  update account_invites
     set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  return jsonb_build_object('status', 'joined', 'account_id', v_inv.account_id);
end;
$$;

-- revoke_account_invite(p_invite_id): the owner cancels a pending invite.
-- Return value: revoked | not_found (also for another account's invite).

create function revoke_account_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'revoke_account_invite: sign-in required'
      using errcode = '42501';
  end if;

  delete from account_invites i
   where i.id = p_invite_id
     and i.accepted_at is null
     and private.is_account_owner(i.account_id);

  if found then
    return jsonb_build_object('status', 'revoked');
  end if;
  return jsonb_build_object('status', 'not_found');
end;
$$;

-- remove_account_member(p_user_id): the owner removes a member (never an owner,
-- so an account can't be left without one). The removed person's sign-in
-- stays; they just have no account until invited again.
-- Return value: removed | not_found (also for someone on another account or an owner).

create function remove_account_member(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'remove_account_member: sign-in required'
      using errcode = '42501';
  end if;

  delete from account_members t
   where t.user_id = p_user_id
     and t.role = 'member'
     and private.is_account_owner(t.account_id);

  if found then
    return jsonb_build_object('status', 'removed');
  end if;
  return jsonb_build_object('status', 'not_found');
end;
$$;

revoke execute on function
  create_account_invite(text, text),
  accept_account_invite(text),
  revoke_account_invite(uuid),
  remove_account_member(uuid)
  from public, anon;
grant execute on function
  create_account_invite(text, text),
  accept_account_invite(text),
  revoke_account_invite(uuid),
  remove_account_member(uuid)
  to authenticated;
