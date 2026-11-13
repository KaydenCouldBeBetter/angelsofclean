-- Angels of Clean — online booking controls (admin Settings, phase 2a)
-- Apply after 20261113202614_admin_preferences.sql.
--
-- Shared by every admin, and they change what customers can book:
--
--   * booking_settings — ONE row: whether online booking is paused (and the
--     message customers see), the minimum notice in hours, and how many days
--     ahead a customer may book.
--   * blackout_dates   — whole days that are closed to customers.
--   * settings_audit   — insert-only record of who changed what, and when.
--
-- Admins read all three. Nobody writes to them directly: the only way in is
-- save_booking_settings / add_blackout_date / remove_blackout_date, which check
-- the admin claim and write the audit entry in the same transaction, so a
-- change can't skip the audit trail. They are SECURITY DEFINER for exactly
-- that reason (no table write privileges are granted to anyone).
--
-- The public booking flow reads the rules through get_booking_rules(), the only
-- thing here anon may call. It returns the pause flag and message, the notice,
-- the day limit and the upcoming blackout dates, and nothing else: no labels,
-- no audit, no bookings. The app enforces the rules again in submitBooking, so
-- the pages only hint and the server decides. Admin-created bookings are never
-- blocked by these rules (admins book custom windows and recurring visits).
--
-- Defaults keep the panel and the booking flow as they were: not paused, no
-- minimum notice, and a 6-day window (the wizard has only ever offered 6 days).
-- supabase/__tests__/booking-controls.test.ts keeps them equal to
-- lib/booking-rules.ts.
--
-- Until this has been applied, the Settings page says the online booking
-- settings couldn't be loaded, and booking attempts are refused with the usual
-- "service unavailable" screen, because the rules can't be read. Apply it
-- before deploying the app change.
--
-- After applying, run `npm run db:types`.

-- booking_settings ----------------------------------------------------------------------

create table booking_settings (
  -- A primary key that can only be true, so there can only ever be one row.
  id                    boolean primary key default true,
  online_booking_paused boolean     not null default false,
  pause_message         text        not null default '',
  min_notice_hours      smallint    not null default 0,
  max_days_ahead        smallint    not null default 6,
  updated_at            timestamptz not null default now(),
  updated_by            text,

  constraint booking_settings_single_row_check check (id),
  -- Must match FIELD_MAX_LENGTHS.pauseMessage in lib/constants.ts.
  constraint booking_settings_pause_message_length check (char_length(pause_message) <= 200),
  constraint booking_settings_min_notice_hours_check check (min_notice_hours between 0 and 168),
  -- 92 is BOOKING_MAX_DAYS_AHEAD in lib/constants.ts.
  constraint booking_settings_max_days_ahead_check check (max_days_ahead between 1 and 92)
);

comment on table booking_settings is 'The one row of online booking rules: pause, minimum notice, how far ahead. Written only by save_booking_settings.';

insert into booking_settings default values;

create trigger booking_settings_set_updated_at
  before update on booking_settings
  for each row execute function set_updated_at();

-- blackout_dates ------------------------------------------------------------------------

create table blackout_dates (
  -- A New York calendar date, like bookings.scheduled_date.
  day        date primary key,
  label      text        not null default '',
  created_by text,
  created_at timestamptz not null default now(),

  -- Must match FIELD_MAX_LENGTHS.blackoutLabel in lib/constants.ts.
  constraint blackout_dates_label_length check (char_length(label) <= 100)
);

comment on table blackout_dates is 'Whole days closed to customers. Labels are for admins only and never sent to the public flow.';

-- settings_audit ------------------------------------------------------------------------

create table settings_audit (
  id          uuid primary key default gen_random_uuid(),
  area        text        not null,
  description text        not null,
  actor       text,
  created_at  timestamptz not null default now()
);
create index settings_audit_created_idx on settings_audit (created_at desc);

comment on table settings_audit is 'Insert-only record of settings changes (what, who, when). Descriptions never include customer data.';

-- Privileges and RLS ----------------------------------------------------------------------
-- Admins may read. No one is granted insert, update or delete: the functions
-- below write as the table owner.

alter table booking_settings enable row level security;
alter table blackout_dates   enable row level security;
alter table settings_audit   enable row level security;

create policy "admin_select_booking_settings" on booking_settings
  for select using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin_select_blackout_dates" on blackout_dates
  for select using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin_select_settings_audit" on settings_audit
  for select using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke all on table booking_settings, blackout_dates, settings_audit from anon, authenticated;
grant select on table booking_settings, blackout_dates, settings_audit to authenticated;

-- get_booking_rules -----------------------------------------------------------------------
--
-- What the public booking flow may know. Callable by anyone, so it returns only
-- these five values, and only blackout dates that haven't passed.
--
-- Return value (jsonb):
--   paused, pause_message, min_notice_hours, max_days_ahead, blackout_dates ["YYYY-MM-DD"]

create function get_booking_rules()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'paused',           s.online_booking_paused,
    'pause_message',    s.pause_message,
    'min_notice_hours', s.min_notice_hours,
    'max_days_ahead',   s.max_days_ahead,
    'blackout_dates',   coalesce(
      (select jsonb_agg(b.day order by b.day)
         from blackout_dates b
        where b.day >= (now() at time zone 'America/New_York')::date),
      '[]'::jsonb)
  )
  from booking_settings s
$$;

revoke execute on function get_booking_rules() from public;
grant execute on function get_booking_rules() to anon, authenticated, service_role;

-- save_booking_settings ---------------------------------------------------------------------
--
-- Saves the four settings and writes one audit entry per thing that changed.
--
-- Return value (jsonb), by "status":
--   saved      { changes: [description] }
--   unchanged  nothing differed; nothing was written

create function save_booking_settings(
  p_paused           boolean,
  p_pause_message    text,
  p_min_notice_hours smallint,
  p_max_days_ahead   smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   text := auth.jwt() ->> 'email';
  v_old     booking_settings%rowtype;
  v_message text := btrim(coalesce(p_pause_message, ''));
  v_changes text[] := '{}';
  v_change  text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'save_booking_settings: admin role required'
      using errcode = '42501';
  end if;

  if p_paused is null or p_min_notice_hours is null or p_max_days_ahead is null then
    raise exception 'save_booking_settings: no value may be null'
      using errcode = '22004';
  end if;

  select * into v_old from booking_settings where id for update;

  -- array_append, not ||: an untyped string literal would be read as an array.
  if v_old.online_booking_paused is distinct from p_paused then
    v_changes := array_append(v_changes, case when p_paused
      then 'Paused online booking'
      else 'Resumed online booking' end);
  end if;
  if v_old.pause_message is distinct from v_message then
    v_changes := array_append(v_changes, 'Changed the pause message');
  end if;
  if v_old.min_notice_hours is distinct from p_min_notice_hours then
    v_changes := array_append(v_changes, format('Changed minimum notice from %s to %s hours',
                                                v_old.min_notice_hours, p_min_notice_hours));
  end if;
  if v_old.max_days_ahead is distinct from p_max_days_ahead then
    v_changes := array_append(v_changes, format('Changed how far ahead customers can book from %s to %s days',
                                                v_old.max_days_ahead, p_max_days_ahead));
  end if;

  if array_length(v_changes, 1) is null then
    return jsonb_build_object('status', 'unchanged');
  end if;

  update booking_settings
     set online_booking_paused = p_paused,
         pause_message         = v_message,
         min_notice_hours      = p_min_notice_hours,
         max_days_ahead        = p_max_days_ahead,
         updated_by            = v_actor
   where id;

  foreach v_change in array v_changes loop
    insert into settings_audit (area, description, actor)
    values ('booking_settings', v_change, v_actor);
  end loop;

  return jsonb_build_object('status', 'saved', 'changes', to_jsonb(v_changes));
end;
$$;

revoke execute on function save_booking_settings(boolean, text, smallint, smallint) from public, anon;
grant execute on function save_booking_settings(boolean, text, smallint, smallint) to authenticated;

-- add_blackout_date -------------------------------------------------------------------------
--
-- Closes one New York calendar day. Today and the future only, and no further
-- out than two years. Existing bookings on the day are left alone (the app
-- shows the admin how many there are first).
--
-- Return value (jsonb), by "status":
--   added | exists | past | too_far

create function add_blackout_date(p_day date, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := auth.jwt() ->> 'email';
  v_today date := (now() at time zone 'America/New_York')::date;
  v_label text := btrim(coalesce(p_label, ''));
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'add_blackout_date: admin role required'
      using errcode = '42501';
  end if;

  if p_day is null then
    raise exception 'add_blackout_date: p_day must not be null'
      using errcode = '22004';
  end if;

  if p_day < v_today then
    return jsonb_build_object('status', 'past');
  end if;
  if p_day > v_today + 730 then
    return jsonb_build_object('status', 'too_far');
  end if;

  insert into blackout_dates (day, label, created_by)
  values (p_day, v_label, v_actor)
  on conflict (day) do nothing;
  if not found then
    return jsonb_build_object('status', 'exists');
  end if;

  insert into settings_audit (area, description, actor)
  values ('blackout_dates',
          'Closed ' || to_char(p_day, 'FMDy, FMMon FMDD, YYYY')
            || case when v_label = '' then '' else ' (' || v_label || ')' end,
          v_actor);

  return jsonb_build_object('status', 'added');
end;
$$;

revoke execute on function add_blackout_date(date, text) from public, anon;
grant execute on function add_blackout_date(date, text) to authenticated;

-- remove_blackout_date ----------------------------------------------------------------------
--
-- Return value (jsonb), by "status": removed | not_found

create function remove_blackout_date(p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := auth.jwt() ->> 'email';
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'remove_blackout_date: admin role required'
      using errcode = '42501';
  end if;

  if p_day is null then
    raise exception 'remove_blackout_date: p_day must not be null'
      using errcode = '22004';
  end if;

  delete from blackout_dates where day = p_day;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  insert into settings_audit (area, description, actor)
  values ('blackout_dates',
          'Reopened ' || to_char(p_day, 'FMDy, FMMon FMDD, YYYY'),
          v_actor);

  return jsonb_build_object('status', 'removed');
end;
$$;

revoke execute on function remove_blackout_date(date) from public, anon;
grant execute on function remove_blackout_date(date) to authenticated;
