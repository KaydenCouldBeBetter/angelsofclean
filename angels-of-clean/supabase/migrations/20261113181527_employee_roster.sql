-- Angels of Clean — add employees from the admin panel, archive instead of delete
-- Apply after 20261112033836_invoice_column_grants.sql.
--
-- Until now the roster was read-only: `employees` had a select grant and nothing
-- else, so staff only existed because the initial migration seeded them. This
-- adds what the admin Employees page needs:
--
--   * archived_at  — null means active. Someone who leaves is archived, never
--                    deleted: the row stays (so every past job still names its
--                    crew) and so does an employee_history entry saying when.
--   * employee_history — one row each time someone is hired, archived or
--                    reactivated, with the admin's email. Insert-only.
--   * unique phone — two roster rows can't share a phone number (compared by
--                    digits, so "(315) 555-0142" and "315-555-0142" collide).
--                    A rehire is a reactivation of the old row, not a new one.
--   * create_employee / set_employee_archived — the only ways the app writes
--                    to these tables, each checking the admin claim.
--   * assign_booking_employees refuses to add an archived employee to a job.
--
-- Archiving is refused while the employee is still on a pending, confirmed or
-- in-progress job that hasn't ended, so no upcoming job is left with a crew
-- member who has left.
--
-- Until this has been applied, the Employees page shows the old roster but
-- adding, archiving and the Active/Archived tabs fail with "Something went
-- wrong"; the page does not fall back to an unsafe write.
--
-- After applying, run `npm run db:types`.
--
-- This migration will fail if two existing employees already share a phone
-- number (digits only). Fix that row by hand first.

-- employees -------------------------------------------------------------------------

alter table employees add column archived_at timestamptz;

-- Must match FIELD_MAX_LENGTHS in lib/constants.ts; supabase/__tests__/field-lengths.test.ts
-- fails if they drift apart.
alter table employees add constraint employees_name_length check (char_length(name) <= 100);
alter table employees add constraint employees_phone_length check (char_length(phone) <= 20);
alter table employees add constraint employees_name_not_blank check (btrim(name) <> '');
alter table employees add constraint employees_initials_not_blank check (btrim(initials) <> '');

create unique index employees_phone_digits_key
  on employees ((regexp_replace(phone, '\D', '', 'g')));

comment on column employees.archived_at is 'Null while the employee is active. Set when they leave; the row is never deleted so past jobs and records stay intact.';

-- Privileges: the app may add a row and read it. It can never delete one, and
-- archived_at changes only through set_employee_archived (which runs as the
-- admin, so that function needs the column grant; RLS still requires the role).
grant insert (name, initials, phone, hired_date) on table employees to authenticated;
grant update (archived_at) on table employees to authenticated;

create policy "admin_insert_employees" on employees
  for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_update_employees" on employees
  for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- employee_history ----------------------------------------------------------------------

create table employee_history (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete restrict,
  action      text not null,
  actor       text,
  created_at  timestamptz not null default now(),
  constraint employee_history_action_check check (action in ('hired', 'archived', 'reactivated'))
);
create index employee_history_employee_idx on employee_history (employee_id, created_at);

comment on table employee_history is 'Insert-only record of when an employee was hired, archived or reactivated, and by which admin.';

alter table employee_history enable row level security;

create policy "admin_select_employee_history" on employee_history
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin_insert_employee_history" on employee_history
  for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No update or delete for anyone, and nothing for anon.
revoke all on table employee_history from anon, authenticated;
grant select, insert on table employee_history to authenticated;

-- create_employee ---------------------------------------------------------------------------
--
-- Return value (jsonb), by "status":
--   created          { id }
--   duplicate_phone  { employee_name, archived } — nothing was written; when
--                    archived is true the admin should reactivate that person

create function create_employee(
  p_name       text,
  p_initials   text,
  p_phone      text,
  p_hired_date date
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_actor    text := auth.jwt() ->> 'email';
  v_existing employees%rowtype;
  v_id       uuid;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'create_employee: admin role required'
      using errcode = '42501';
  end if;

  select * into v_existing
    from employees
   where regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g');
  if found then
    return jsonb_build_object(
      'status',        'duplicate_phone',
      'employee_name', v_existing.name,
      'archived',      v_existing.archived_at is not null
    );
  end if;

  insert into employees (name, initials, phone, hired_date)
  values (btrim(p_name), btrim(p_initials), btrim(p_phone), p_hired_date)
  returning id into v_id;

  insert into employee_history (employee_id, action, actor)
  values (v_id, 'hired', v_actor);

  return jsonb_build_object('status', 'created', 'id', v_id);
end;
$$;

revoke execute on function create_employee(text, text, text, date) from public, anon;
grant execute on function create_employee(text, text, text, date) to authenticated;

-- set_employee_archived ---------------------------------------------------------------------
--
-- Return value (jsonb), by "status":
--   archived | reactivated
--   unchanged        already in the state asked for; nothing written
--   has_upcoming     { booking_numbers: [n] } — still on jobs that haven't
--                    ended; nothing was changed
--   not_found

create function set_employee_archived(
  p_employee_id uuid,
  p_archived    boolean
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_actor    text := auth.jwt() ->> 'email';
  v_employee employees%rowtype;
  v_numbers  jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'set_employee_archived: admin role required'
      using errcode = '42501';
  end if;

  if p_archived is null then
    raise exception 'set_employee_archived: p_archived must not be null'
      using errcode = '22004';
  end if;

  -- The same per-cleaner lock assign_booking_employees takes, so an archive
  -- and an assignment of the same person can't both slip past each other's check.
  perform pg_advisory_xact_lock(hashtextextended('booking_employees:' || p_employee_id::text, 0));

  select * into v_employee from employees where id = p_employee_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if (v_employee.archived_at is not null) = p_archived then
    return jsonb_build_object('status', 'unchanged');
  end if;

  if p_archived then
    select coalesce(jsonb_agg(b.booking_number order by b.start_at), '[]'::jsonb)
      into v_numbers
      from booking_employees be
      join bookings b on b.id = be.booking_id
     where be.employee_id = p_employee_id
       and b.status in ('pending', 'confirmed', 'active')
       and b.end_at > now();

    if jsonb_array_length(v_numbers) > 0 then
      return jsonb_build_object('status', 'has_upcoming', 'booking_numbers', v_numbers);
    end if;

    update employees set archived_at = now() where id = p_employee_id;
    insert into employee_history (employee_id, action, actor)
    values (p_employee_id, 'archived', v_actor);
    return jsonb_build_object('status', 'archived');
  end if;

  update employees set archived_at = null where id = p_employee_id;
  insert into employee_history (employee_id, action, actor)
  values (p_employee_id, 'reactivated', v_actor);
  return jsonb_build_object('status', 'reactivated');
end;
$$;

revoke execute on function set_employee_archived(uuid, boolean) from public, anon;
grant execute on function set_employee_archived(uuid, boolean) to authenticated;

-- assign_booking_employees: no archived cleaners -------------------------------------------
--
-- Same function as 20261018142718, with one more result, `archived`
-- { employees: [name] }, returned (nothing changed) when a newly added cleaner
-- has been archived. Someone already on the job who is archived later can stay
-- until the job is reassigned, because only newly added cleaners are checked.

create or replace function assign_booking_employees(
  p_booking_id            uuid,
  p_employee_ids          uuid[],
  p_expected_employee_ids uuid[],
  p_allow_overlap         boolean default false
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_booking   bookings%rowtype;
  v_wanted    uuid[];
  v_current   uuid[];
  v_added     uuid[];
  v_removed   uuid[];
  v_employee  uuid;
  v_conflicts jsonb;
  v_archived  jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'assign_booking_employees: admin role required'
      using errcode = '42501';
  end if;

  if p_employee_ids is null or p_expected_employee_ids is null then
    raise exception 'assign_booking_employees: employee id arrays must not be null'
      using errcode = '22004';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_booking.status in ('cancelled', 'done') then
    return jsonb_build_object('status', 'closed', 'booking_status', v_booking.status);
  end if;

  v_current := array(
    select employee_id from booking_employees
    where booking_id = p_booking_id
    order by employee_id
  );
  if v_current <> array(select distinct e from unnest(p_expected_employee_ids) e order by e) then
    return jsonb_build_object('status', 'stale');
  end if;

  v_wanted  := array(select distinct e from unnest(p_employee_ids) e order by e);
  v_added   := array(select e from unnest(v_wanted)  e where e <> all (v_current) order by e);
  v_removed := array(select e from unnest(v_current) e where e <> all (v_wanted)  order by e);

  foreach v_employee in array v_added loop
    perform pg_advisory_xact_lock(hashtextextended('booking_employees:' || v_employee::text, 0));
  end loop;

  -- Checked after the locks, so an archive that was in flight has finished.
  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
    into v_archived
    from employees
   where id = any (v_added)
     and archived_at is not null;

  if jsonb_array_length(v_archived) > 0 then
    return jsonb_build_object('status', 'archived', 'employees', v_archived);
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'employee_id',    be.employee_id,
               'employee_name',  em.name,
               'booking_id',     b.id,
               'booking_number', b.booking_number,
               'start_at',       b.start_at,
               'end_at',         b.end_at
             )
             order by em.name, b.start_at
           ),
           '[]'::jsonb
         )
    into v_conflicts
    from booking_employees be
    join bookings  b  on b.id  = be.booking_id
    join employees em on em.id = be.employee_id
   where be.employee_id = any (v_added)
     and b.id <> p_booking_id
     and b.status <> 'cancelled'
     and b.start_at < v_booking.end_at
     and b.end_at   > v_booking.start_at;

  if jsonb_array_length(v_conflicts) > 0 and not coalesce(p_allow_overlap, false) then
    return jsonb_build_object('status', 'conflicts', 'conflicts', v_conflicts);
  end if;

  delete from booking_employees
   where booking_id = p_booking_id
     and employee_id = any (v_removed);

  insert into booking_employees (booking_id, employee_id)
  select p_booking_id, e from unnest(v_added) e;

  return jsonb_build_object(
    'status',     'saved',
    'added',      (select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
                     from employees where id = any (v_added)),
    'removed',    (select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
                     from employees where id = any (v_removed)),
    'overridden', v_conflicts
  );
end;
$$;
