-- Angels of Clean — half-bathrooms (backlog B42, data part)
-- Apply after 20261019162530_verification_cleanup.sql.
--
-- The owner decided on 2026-10-19 that a booking can have half-bathrooms
-- (2.5 bathrooms). bookings.bathrooms was smallint, so it changes to
-- numeric(2,1): 1 to 5 in steps of 0.5, which the CHECK enforces. The app
-- uses the same limits (BATHROOM_LIMITS in lib/constants.ts).
--
-- Existing rows are whole numbers from 1 to 5 (the old smallint CHECK), so
-- every one converts exactly and satisfies the new CHECK. Column privileges,
-- such as the admin insert grant in 20261019162530, carry over to the new type.
--
-- numeric(2,1) rounds anything finer than a tenth before the CHECK runs, so
-- the database stores 1.49 as 1.5. createBooking (app/actions/submitBooking.ts)
-- refuses anything that isn't an exact half step before it reaches the insert.

alter table bookings drop constraint bookings_bathrooms_check;

alter table bookings
  alter column bathrooms type numeric(2,1) using bathrooms::numeric(2,1);

alter table bookings
  add constraint bookings_bathrooms_check
  check (bathrooms between 1 and 5 and (bathrooms * 2) = trunc(bathrooms * 2));
