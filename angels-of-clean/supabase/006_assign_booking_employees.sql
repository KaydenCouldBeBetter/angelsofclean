-- Angels of Clean — safe crew assignment with overlap warnings (backlog B14)
-- Run this once in the Supabase SQL Editor, after 002 (the function checks
-- the admin role claim that 002 introduced).
--
-- assignEmployees used to delete a job's whole crew and then insert the new
-- one as two separate requests. If the insert failed, the job silently lost
-- everyone. Nothing checked whether a cleaner was already on another job at
-- the same time, and two admins saving the same job overwrote each other.
-- This function does the whole change in one transaction:
--   * refuses cancelled and completed jobs
--   * refuses the save if the crew changed since the admin loaded the page
--   * warns about overlapping jobs for each newly added cleaner, unless the
--     admin chose "Assign anyway" (p_allow_overlap)
--   * applies only the difference, so cleaners who stay keep their row
--
-- Until this has been run, saving an assignment shows the admin "Something
-- went wrong. Please try again." — it never falls back to the old unsafe save.
--
-- Return value (jsonb), by "status":
--   saved      { added: [name], removed: [name], overridden: [conflict] }
--   conflicts  { conflicts: [conflict] }  — nothing was changed
--   stale      the crew changed since the page loaded — nothing was changed
--   closed     { booking_status }         — cancelled or done job
--   not_found
-- where conflict = { employee_id, employee_name, booking_id, booking_number,
--                    start_at, end_at }.

create function assign_booking_employees(
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
begin
  -- Security invoker, so RLS applies too; this just fails loudly instead of
  -- returning not_found to a non-admin.
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'assign_booking_employees: admin role required'
      using errcode = '42501';
  end if;

  if p_employee_ids is null or p_expected_employee_ids is null then
    raise exception 'assign_booking_employees: employee id arrays must not be null'
      using errcode = '22004';
  end if;

  -- Locking the booking row serializes saves on the same job, so the stale
  -- check below can't race another save.
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

  -- Two admins assigning the same cleaner to different jobs at once could each
  -- see the other job as not yet saved. A per-cleaner lock makes the second
  -- save wait for the first, then see its row. Taken in id order so two saves
  -- can't deadlock. Held until the transaction ends.
  foreach v_employee in array v_added loop
    perform pg_advisory_xact_lock(hashtextextended('booking_employees:' || v_employee::text, 0));
  end loop;

  -- Only newly added cleaners are checked, so a previously accepted overlap
  -- doesn't warn again every time the rest of the crew changes. Back-to-back
  -- jobs (one ends exactly when the other starts) don't overlap.
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

-- Functions in `public` are callable over the API by default. Signed-in
-- admins call this through their own session; anon never may.
revoke execute on function assign_booking_employees(uuid, uuid[], uuid[], boolean) from public, anon;
grant execute on function assign_booking_employees(uuid, uuid[], uuid[], boolean) to authenticated;
