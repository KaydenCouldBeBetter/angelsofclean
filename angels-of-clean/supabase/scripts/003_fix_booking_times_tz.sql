-- 003_fix_booking_times_tz.sql
-- B8 data backfill — DO NOT run automatically. Review the diagnostic first,
-- then run the UPDATE only if wrong rows are found.
--
-- Background: before B8, start_at/end_at were built with
--   new Date(`${date}T08:00:00`)
-- which parsed the slot window in the SERVER's local timezone. On a UTC server
-- (e.g. Vercel), New York 8:00 AM was stored as 08:00Z — which is 4:00 AM (EDT)
-- or 3:00 AM (EST) in New York, i.e. 4–5 hours too early. Rows created while the
-- server happened to run in America/New_York are already correct. This script
-- rebuilds the affected rows from the authoritative scheduled_date + time_slot.

-- ── Step 1: DIAGNOSTIC (read-only) ──────────────────────────────────────────
-- Lists any booking whose stored start_at does NOT fall on its New York slot
-- boundary (morning = 08:00, afternoon = 12:00). If ny_start_time reads 04:00 /
-- 03:00 for morning rows, they were stored under a UTC server and need fixing.
-- An empty result means all rows are already correct.
SELECT
  id,
  booking_number,
  scheduled_date,
  time_slot,
  start_at,
  (start_at AT TIME ZONE 'America/New_York')::time AS ny_start_time,
  (end_at   AT TIME ZONE 'America/New_York')::time AS ny_end_time
FROM bookings
WHERE (start_at AT TIME ZONE 'America/New_York')::time
      <> CASE time_slot
           WHEN 'morning'   THEN TIME '08:00'
           WHEN 'afternoon' THEN TIME '12:00'
         END
   OR (end_at AT TIME ZONE 'America/New_York')::time
      <> CASE time_slot
           WHEN 'morning'   THEN TIME '12:00'
           WHEN 'afternoon' THEN TIME '16:00'
         END;

-- ── Step 2: CORRECTION (only if Step 1 returned rows) ───────────────────────
-- Rebuilds start_at/end_at from scheduled_date + time_slot, interpreted in
-- America/New_York (Postgres AT TIME ZONE handles DST). Idempotent: re-running
-- it leaves already-correct rows unchanged because the WHERE clause re-filters.
--
-- UPDATE bookings
-- SET start_at = (scheduled_date
--       + CASE time_slot WHEN 'morning' THEN TIME '08:00'
--                        WHEN 'afternoon' THEN TIME '12:00' END
--     ) AT TIME ZONE 'America/New_York',
--     end_at = (scheduled_date
--       + CASE time_slot WHEN 'morning' THEN TIME '12:00'
--                        WHEN 'afternoon' THEN TIME '16:00' END
--     ) AT TIME ZONE 'America/New_York',
--     updated_at = now()
-- WHERE (start_at AT TIME ZONE 'America/New_York')::time
--       <> CASE time_slot WHEN 'morning' THEN TIME '08:00'
--                         WHEN 'afternoon' THEN TIME '12:00' END
--    OR (end_at AT TIME ZONE 'America/New_York')::time
--       <> CASE time_slot WHEN 'morning' THEN TIME '12:00'
--                         WHEN 'afternoon' THEN TIME '16:00' END;
