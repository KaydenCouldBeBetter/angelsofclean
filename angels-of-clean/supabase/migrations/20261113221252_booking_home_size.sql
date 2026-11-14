-- Angels of Clean — home size on bookings (admin Settings phase 2b, step 1)
-- Apply after 20261113205039_booking_controls.sql.
--
-- A two-person crew does about three or four small homes (1,800 sq ft or less)
-- in a day, or two large ones (2,500 sq ft or more), so how many bookings a
-- slot can take depends on how big the homes are. The booking form only asked
-- for bedrooms and bathrooms, which isn't the same thing. This adds the size the
-- customer (or the office) gives, so the crew limit in the next step has
-- something to count:
--
--   * bookings.home_size — 'under-1800' | '1800-2500' | 'over-2500' | 'unsure'.
--     Nullable on purpose: every booking made before this existed has none, and
--     the office should see "not recorded", not a guess. The app requires it on
--     every new booking. supabase/__tests__/booking-home-size.test.ts keeps the
--     list equal to HOME_SIZE_OPTIONS in lib/home-size.ts.
--   * set_booking_home_size — how the office corrects it (a customer who said
--     "not sure", or got it wrong). Admin only, refused on a finished or
--     cancelled booking, and writes an activity entry in the same transaction.
--
-- Nothing else changes: no existing booking is touched, and nothing counts the
-- size yet. The admin New Booking form writes the column through its own
-- session, so the insert grant for admins gains it.
--
-- Until this has been applied, every new booking fails with "Something went
-- wrong. Please try again.", because the app now sends home_size. Apply it
-- before deploying the app change.
--
-- After applying, run `npm run db:types`.

alter table bookings add column home_size text;

alter table bookings add constraint bookings_home_size_check
  check (home_size in ('under-1800', '1800-2500', 'over-2500', 'unsure'));

comment on column bookings.home_size is 'About how big the home is, as the customer or office gave it. Null on bookings made before it was asked ("not recorded").';

-- The admin session writes the column when the office creates a booking.
-- (Service role, used by the public form, can already insert every column.)
grant insert (home_size) on table bookings to authenticated;

-- set_booking_home_size -------------------------------------------------------------------
--
-- Security invoker, like set_booking_access: RLS and the table grants apply, and
-- the admin check makes it fail loudly for anyone else. Changing the size of a
-- booking that is done or cancelled would only rewrite history, so it is refused.
--
-- Return value (jsonb), by "status":
--   saved | unchanged | closed { booking_status } | not_found

create function set_booking_home_size(
  p_booking_id uuid,
  p_home_size  text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_actor   text := auth.jwt() ->> 'email';
  v_booking bookings%rowtype;
  v_labels  constant jsonb := jsonb_build_object(
    'under-1800', 'under 1,800 sq ft',
    '1800-2500',  '1,800 to 2,500 sq ft',
    'over-2500',  '2,500 sq ft or more',
    'unsure',     'not sure'
  );
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'set_booking_home_size: admin role required'
      using errcode = '42501';
  end if;

  -- The CHECK allows null (old bookings); a save must never clear the size.
  if p_home_size is null then
    raise exception 'set_booking_home_size: p_home_size must not be null'
      using errcode = '22004';
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_booking.status in ('cancelled', 'done') then
    return jsonb_build_object('status', 'closed', 'booking_status', v_booking.status);
  end if;

  if v_booking.home_size is not distinct from p_home_size then
    return jsonb_build_object('status', 'unchanged');
  end if;

  -- A value outside the list raises 23514 here, from the table's CHECK.
  update bookings set home_size = p_home_size where id = p_booking_id;

  insert into activity_log (booking_id, description, actor, action)
  values (
    p_booking_id,
    'Home size set to ' || (v_labels ->> p_home_size)
      || case when v_booking.home_size is null
              then ' (it was not recorded)'
              else ' (was ' || (v_labels ->> v_booking.home_size) || ')' end
      || coalesce(' by ' || v_actor, ''),
    v_actor,
    'home_size_updated'
  );

  return jsonb_build_object('status', 'saved');
end;
$$;

revoke execute on function set_booking_home_size(uuid, text) from public, anon;
grant execute on function set_booking_home_size(uuid, text) to authenticated;
