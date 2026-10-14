-- Angels of Clean — rate limiting for the public booking form (backlog B5)
-- Run this once in the Supabase SQL Editor, after 003.
--
-- submitBooking is unauthenticated by design, so nothing stopped a script from
-- flooding the bookings table. This adds a small fixed-window counter that the
-- server calls (via the service-role client) before each public insert.
--
-- Until this has been run, the app logs "allowPublicBooking failed" and lets
-- bookings through unlimited — it fails open so customers are never blocked by
-- a missing migration.

create table rate_limits (
  bucket       text        not null,  -- e.g. 'booking:<keyed hash of the client IP>' — never a raw IP
  window_start timestamptz not null,
  hits         integer     not null default 1,
  primary key (bucket, window_start)
);
create index rate_limits_window_start_idx on rate_limits (window_start);

-- RLS on with no policies: only the service-role client can read or write.
alter table rate_limits enable row level security;

-- Counts one hit against `p_bucket` in the current window and returns whether
-- the caller is still within `p_limit`. The upsert makes the count atomic, so
-- concurrent requests can't both slip under the limit.
create function check_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into rate_limits as r (bucket, window_start)
  values (p_bucket, v_window)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Old windows are useless once they close; keep the table small.
  delete from rate_limits where window_start < now() - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

-- Functions in `public` are callable over the API by default. Only the server
-- (service role) may call this one.
revoke execute on function check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function check_rate_limit(text, integer, integer) to service_role;
