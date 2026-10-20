-- Angels of Clean — one booking status flow, enforced in Postgres (backlog B12)
-- Apply after 20261019033138_db_defense_in_depth.sql.
--
-- updateBookingStatus used to write any status over any other, so a cancelled
-- or completed booking could be brought back by accident, and the status
-- change and its activity entry were two separate requests (one could land
-- without the other). This migration:
--   * defines the one allowed flow (below) and refuses every other status
--     change on bookings, whoever makes it
--   * adds set_booking_status(), which changes the status and writes the
--     activity entry in one transaction and one round trip
--   * adds activity_log.actor (taken from the caller's JWT, never a
--     parameter) and activity_log.action
--   * makes activity_log append-only: admins may read and insert, nobody may
--     edit or delete an entry through the API
--
-- The flow:
--   pending → confirmed → active → done
--   pending | confirmed | active → cancelled
-- done and cancelled are final; nothing reopens. The app mirrors this list in
-- app/admin/status-config.ts (STATUS_TRANSITIONS); a test keeps them equal.
--
-- Until this has been run, Confirm / Mark Complete / Cancel show the admin
-- "Something went wrong. Please try again." — the app never falls back to
-- the old unchecked update.
--
-- A hand-run data fix that really must reopen a booking has to disable the
-- trigger for that statement (alter table bookings disable trigger
-- bookings_status_transition; … enable trigger …).

-- Transition rule ------------------------------------------------------------

create function booking_status_transition_allowed(p_from booking_status, p_to booking_status)
returns boolean
language sql
immutable
set search_path = public
as $$
  select (p_from, p_to) in (
    ('pending',   'confirmed'),
    ('confirmed', 'active'),
    ('active',    'done'),
    ('pending',   'cancelled'),
    ('confirmed', 'cancelled'),
    ('active',    'cancelled')
  );
$$;

-- Enforced on the table itself, so a direct update through the API (admins
-- still have an update policy on bookings) can't skip the flow either.
-- Updates that leave the status as it is aren't checked.
create function enforce_booking_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not booking_status_transition_allowed(old.status, new.status) then
    raise exception 'booking status cannot change from % to %', old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger bookings_status_transition
  before update of status on bookings
  for each row
  when (old.status is distinct from new.status)
  execute function enforce_booking_status_transition();

-- activity_log: who did it, and what ------------------------------------------

-- actor defaults to the signed-in user's email, so entries the app inserts
-- directly (crew changes) get it too. Customer submissions go through the
-- service role, whose token has no email, so their actor stays null. Older
-- rows keep null in both columns; their description already says who.
alter table activity_log
  add column actor  text default (auth.jwt() ->> 'email'),
  add column action text;

comment on column activity_log.actor  is 'Email of the signed-in user who made the change, from their JWT. Null for customer submissions and rows written before B12.';
comment on column activity_log.action is 'Machine-readable kind of change, e.g. status_confirmed. Null for rows written before B12 and for entries that have no code yet.';

-- Append-only: replaces 20260918194509's "for all" policy. With RLS on and no
-- update/delete policy, those statements match no rows; the privileges below
-- make them fail outright. The insert check stops an admin writing someone
-- else's email as the actor.
drop policy "admin_all_activity_log" on activity_log;

create policy "admin_select_activity_log" on activity_log
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_insert_activity_log" on activity_log
  for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and actor is not distinct from (auth.jwt() ->> 'email')
  );

-- Same trim as 20261019033138 did for the other tables, which left
-- activity_log to this change. anon gets nothing: customer submissions log
-- through the service role. authenticated may read (booking detail page) and
-- append (set_booking_status and crew changes, both security invoker).
revoke all on table activity_log from anon, authenticated;
grant select, insert on table activity_log to authenticated;

-- set_booking_status ------------------------------------------------------------
--
-- p_description is the activity label the app shows ("Confirmed", "Marked
-- complete"; labels live in app/admin/status-config.ts). The function appends
-- " by {actor}" itself.
--
-- Return value (jsonb), by "status":
--   changed    { from, to }        — status updated and activity logged
--   refused    { booking_status }  — that move isn't allowed from the current
--                                     status; nothing was changed
--   not_found

create function set_booking_status(
  p_booking_id  uuid,
  p_status      booking_status,
  p_description text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_actor text := auth.jwt() ->> 'email';
  v_from  booking_status;
begin
  -- Security invoker, so RLS applies too; this just fails loudly instead of
  -- returning not_found to a non-admin.
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'set_booking_status: admin role required'
      using errcode = '42501';
  end if;

  if p_status is null or nullif(btrim(p_description), '') is null then
    raise exception 'set_booking_status: status and description are required'
      using errcode = '22004';
  end if;

  -- Locking the row means two admins changing the same booking at once are
  -- checked one after the other, each against the status the other left.
  select status into v_from from bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not booking_status_transition_allowed(v_from, p_status) then
    return jsonb_build_object('status', 'refused', 'booking_status', v_from);
  end if;

  update bookings
     set status = p_status, updated_at = now()
   where id = p_booking_id;

  insert into activity_log (booking_id, description, actor, action)
  values (
    p_booking_id,
    p_description || coalesce(' by ' || v_actor, ''),
    v_actor,
    'status_' || p_status
  );

  return jsonb_build_object('status', 'changed', 'from', v_from, 'to', p_status);
end;
$$;

-- Functions in `public` are callable over the API by default. Signed-in
-- admins call this through their own session; anon never may.
revoke execute on function set_booking_status(uuid, booking_status, text) from public, anon;
grant execute on function set_booking_status(uuid, booking_status, text) to authenticated;
