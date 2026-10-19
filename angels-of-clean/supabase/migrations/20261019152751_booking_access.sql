-- Angels of Clean — a separate home for entry instructions (backlog B38)
-- Apply after 20261019035418_booking_status_flow.sql.
--
-- Door codes, gate codes and notes about pets used to end up in
-- bookings.notes, which several admin queries select. They now live in their
-- own table that only the booking detail page reads (getBookingAccess in
-- lib/supabase/queries.ts); the list, calendar and dashboard queries select
-- from bookings only and never join it.
--
-- Admins only, for now. Showing instructions to the assigned cleaner around
-- the job window waits for the owner's decision on the employee app.
--
-- Until this has been run, a booking submitted with entry instructions fails
-- with "Something went wrong" (bookings without them are unaffected), and the
-- booking detail page says the instructions couldn't be loaded.
--
-- After applying, run `npm run db:types`.

create table booking_access (
  booking_id   uuid primary key references bookings (id) on delete cascade,
  instructions text not null,
  updated_at   timestamptz not null default now(),
  -- Must match FIELD_MAX_LENGTHS.accessInstructions in lib/constants.ts;
  -- supabase/__tests__/field-lengths.test.ts fails if they drift apart.
  constraint booking_access_instructions_length check (char_length(instructions) <= 500),
  -- No instructions means no row.
  constraint booking_access_instructions_not_blank check (btrim(instructions) <> '')
);

comment on table booking_access is 'Entry instructions (door code, gate, pets) for a booking. Admin-only; read only by the booking detail page. Never copy into activity_log, notes or emails.';

create trigger booking_access_set_updated_at
  before update on booking_access
  for each row execute function set_updated_at();

-- RLS: admins only ----------------------------------------------------------------

alter table booking_access enable row level security;

create policy "admin_select_booking_access" on booking_access
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_insert_booking_access" on booking_access
  for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_update_booking_access" on booking_access
  for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_delete_booking_access" on booking_access
  for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Privileges, trimmed like 20261019033138 did for the other tables. anon gets
-- nothing: the public booking form writes through the service role.
-- authenticated gets what set_booking_access (security invoker) uses; RLS
-- still requires the admin role on every row.
revoke all on table booking_access from anon, authenticated;
grant select, insert, update, delete on table booking_access to authenticated;
-- The public booking insert (app/actions/submitBooking.ts).
grant insert on table booking_access to service_role;

-- set_booking_access --------------------------------------------------------------
--
-- Saves, replaces or (with a blank value) removes a booking's entry
-- instructions and appends an activity entry in the same transaction. The
-- entry says only that the instructions changed, never what they say.
--
-- Return value (jsonb), by "status":
--   saved      — instructions stored
--   removed    — a blank value deleted the existing instructions
--   unchanged  — same as what was stored; nothing written or logged
--   not_found

create function set_booking_access(
  p_booking_id   uuid,
  p_instructions text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_actor text := auth.jwt() ->> 'email';
  v_new   text := nullif(btrim(p_instructions), '');
  v_old   text;
  v_label text;
begin
  -- Security invoker, so RLS applies too; this just fails loudly instead of
  -- returning not_found to a non-admin.
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'set_booking_access: admin role required'
      using errcode = '42501';
  end if;

  perform 1 from bookings where id = p_booking_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select instructions into v_old
    from booking_access
   where booking_id = p_booking_id
     for update;

  if v_old is not distinct from v_new then
    return jsonb_build_object('status', 'unchanged');
  end if;

  if v_new is null then
    delete from booking_access where booking_id = p_booking_id;
    v_label := 'Entry instructions removed';
  else
    insert into booking_access (booking_id, instructions)
    values (p_booking_id, v_new)
    on conflict (booking_id) do update set instructions = excluded.instructions;
    v_label := case when v_old is null then 'Entry instructions added'
                    else 'Entry instructions updated' end;
  end if;

  insert into activity_log (booking_id, description, actor, action)
  values (
    p_booking_id,
    v_label || coalesce(' by ' || v_actor, ''),
    v_actor,
    case when v_new is null then 'access_removed' else 'access_updated' end
  );

  return jsonb_build_object('status', case when v_new is null then 'removed' else 'saved' end);
end;
$$;

-- Signed-in admins call this through their own session; anon never may.
revoke execute on function set_booking_access(uuid, text) from public, anon;
grant execute on function set_booking_access(uuid, text) to authenticated;
