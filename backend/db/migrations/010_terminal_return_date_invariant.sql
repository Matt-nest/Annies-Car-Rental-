-- Migration 010 — Prevent ghost-blocked vehicles
--
-- Bug: a booking could reach status 'returned' or 'completed' while its
-- return_date was still in the future (early return path didn't clamp the
-- date, /complete didn't either). The availability check then treated the
-- terminal row as still occupying the calendar, producing 409 "Those dates
-- are no longer available" on a vehicle that was physically back on the lot.
--
-- This migration:
--   (1) Backfills every existing 'returned'/'completed' booking whose
--       return_date is past today, clamping return_date to the actual
--       return day (actual_return_at::date if present, else today).
--   (2) Adds a CHECK constraint so no future code path, manual SQL, or
--       import script can re-introduce the invariant violation.

BEGIN;

-- (1) Backfill. Surface what's about to change for the audit trail.
WITH offenders AS (
  SELECT
    id,
    booking_code,
    status,
    return_date AS old_return_date,
    COALESCE(actual_return_at::date, CURRENT_DATE) AS new_return_date
  FROM bookings
  WHERE status IN ('returned', 'completed')
    AND return_date > COALESCE(actual_return_at::date, CURRENT_DATE)
),
updated AS (
  UPDATE bookings b
     SET return_date = o.new_return_date
    FROM offenders o
   WHERE b.id = o.id
  RETURNING b.id, o.booking_code, o.status, o.old_return_date, b.return_date AS new_return_date
)
INSERT INTO booking_status_log (booking_id, from_status, to_status, changed_by, reason)
SELECT
  id,
  status,
  status,
  'system_migration_010',
  format(
    'Backfill: clamped return_date %s → %s to repair ghost-blocked calendar',
    old_return_date, new_return_date
  )
FROM updated;

-- (2) Constraint. The invariant is now enforced by the database itself.
ALTER TABLE bookings
  ADD CONSTRAINT bookings_terminal_return_date_not_future
  CHECK (
    status NOT IN ('returned', 'completed')
    OR return_date <= COALESCE(actual_return_at::date, CURRENT_DATE)
  );

COMMIT;
