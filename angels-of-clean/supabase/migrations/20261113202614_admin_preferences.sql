-- Angels of Clean — per-admin display preferences for the Settings page
-- Apply after 20261113181527_employee_roster.sql.
--
-- Each admin gets at most one row in admin_preferences holding how their own
-- panel looks and starts up: the page they land on after signing in, the
-- calendar's default view, first weekday and visible hours, whether the
-- Unassigned list starts hidden, and the Bookings list's default filter.
-- These are preferences, never permissions: nothing here grants or limits
-- access, and a missing row means "use the defaults" (the app has the same
-- defaults in lib/admin-preferences.ts; supabase/__tests__/admin-preferences.test.ts
-- fails if the two drift apart).
--
--   * Admins only. A row is visible and writable only to the admin whose
--     user_id it is: RLS compares user_id with the caller's own id and also
--     requires app_metadata.role = 'admin'. One admin cannot read or change
--     another's row, and no one can delete one through the API (it goes when
--     the account is deleted).
--   * save_admin_preferences is the only way the app writes. It takes the user
--     from the caller's JWT, never from a parameter, so a call can only ever
--     change the caller's own row. user_id is never updatable.
--   * Every value has a CHECK, so the database refuses anything the Settings
--     form would not offer, whoever sends it.
--
-- Until this has been applied the Settings page shows "couldn't load" and every
-- other admin page uses the defaults; nothing else depends on the table.
--
-- After applying, run `npm run db:types`.

create table admin_preferences (
  user_id                   uuid primary key references auth.users (id) on delete cascade,
  landing_page              text     not null default 'dashboard',
  calendar_view             text     not null default 'week',
  week_starts_on            text     not null default 'sunday',
  calendar_start_hour       smallint not null default 7,
  calendar_end_hour         smallint not null default 17,
  unassigned_list_collapsed boolean  not null default false,
  bookings_default_filter   text     not null default 'today',
  updated_at                timestamptz not null default now(),

  constraint admin_preferences_landing_page_check
    check (landing_page in ('dashboard', 'calendar', 'bookings')),
  constraint admin_preferences_calendar_view_check
    check (calendar_view in ('week', 'month')),
  constraint admin_preferences_week_starts_on_check
    check (week_starts_on in ('sunday', 'monday')),
  constraint admin_preferences_bookings_default_filter_check
    check (bookings_default_filter in ('today', 'upcoming', 'past', 'all')),
  -- Hours on New York's clock. The end may be 24 (midnight). At least four
  -- visible hours, so the week grid can't be squeezed to nothing.
  constraint admin_preferences_start_hour_check
    check (calendar_start_hour between 0 and 23),
  constraint admin_preferences_end_hour_check
    check (calendar_end_hour between 1 and 24),
  constraint admin_preferences_hours_order_check
    check (calendar_end_hour - calendar_start_hour >= 4)
);

comment on table admin_preferences is 'One row per admin: how their own panel looks and starts up. Preferences only, never permissions.';

create trigger admin_preferences_set_updated_at
  before update on admin_preferences
  for each row execute function set_updated_at();

alter table admin_preferences enable row level security;

create policy "admin_select_own_preferences" on admin_preferences
  for select
  using (
    user_id = (select auth.uid())
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "admin_insert_own_preferences" on admin_preferences
  for insert
  with check (
    user_id = (select auth.uid())
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "admin_update_own_preferences" on admin_preferences
  for update
  using (
    user_id = (select auth.uid())
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    user_id = (select auth.uid())
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Nothing for anon. Admins may read, insert and update the preference columns;
-- user_id is insertable (the function sets it) but never updatable, and there
-- is no delete.
revoke all on table admin_preferences from anon, authenticated;
grant select on table admin_preferences to authenticated;
grant insert (
  user_id, landing_page, calendar_view, week_starts_on,
  calendar_start_hour, calendar_end_hour, unassigned_list_collapsed,
  bookings_default_filter
) on table admin_preferences to authenticated;
grant update (
  landing_page, calendar_view, week_starts_on,
  calendar_start_hour, calendar_end_hour, unassigned_list_collapsed,
  bookings_default_filter
) on table admin_preferences to authenticated;

-- save_admin_preferences -----------------------------------------------------------------
--
-- Saves (or creates) the caller's own preferences in one statement. A value the
-- CHECKs refuse raises 23514 and nothing is written. Security invoker, so RLS and
-- the column grants above apply to it as they do to the caller.
--
-- Return value (jsonb): { "status": "saved" }

create function save_admin_preferences(
  p_landing_page              text,
  p_calendar_view             text,
  p_week_starts_on            text,
  p_calendar_start_hour       smallint,
  p_calendar_end_hour         smallint,
  p_unassigned_list_collapsed boolean,
  p_bookings_default_filter   text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null
     or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'save_admin_preferences: admin role required'
      using errcode = '42501';
  end if;

  if p_landing_page is null or p_calendar_view is null or p_week_starts_on is null
     or p_calendar_start_hour is null or p_calendar_end_hour is null
     or p_unassigned_list_collapsed is null or p_bookings_default_filter is null then
    raise exception 'save_admin_preferences: no value may be null'
      using errcode = '22004';
  end if;

  insert into admin_preferences (
    user_id, landing_page, calendar_view, week_starts_on,
    calendar_start_hour, calendar_end_hour, unassigned_list_collapsed,
    bookings_default_filter
  )
  values (
    v_user, p_landing_page, p_calendar_view, p_week_starts_on,
    p_calendar_start_hour, p_calendar_end_hour, p_unassigned_list_collapsed,
    p_bookings_default_filter
  )
  on conflict (user_id) do update set
    landing_page              = excluded.landing_page,
    calendar_view             = excluded.calendar_view,
    week_starts_on            = excluded.week_starts_on,
    calendar_start_hour       = excluded.calendar_start_hour,
    calendar_end_hour         = excluded.calendar_end_hour,
    unassigned_list_collapsed = excluded.unassigned_list_collapsed,
    bookings_default_filter   = excluded.bookings_default_filter;

  return jsonb_build_object('status', 'saved');
end;
$$;

revoke execute on function save_admin_preferences(text, text, text, smallint, smallint, boolean, text)
  from public, anon;
grant execute on function save_admin_preferences(text, text, text, smallint, smallint, boolean, text)
  to authenticated;
