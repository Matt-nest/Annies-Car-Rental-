-- ============================================================================
-- PRE-LAUNCH DATA WIPE — preserves three real bookings + their dependencies
-- ============================================================================
--
-- HOW TO RUN (Supabase Dashboard → SQL Editor):
--
--   STEP 1 (DRY RUN — verify counts, nothing is committed):
--     • Paste this entire file into the SQL editor.
--     • Run it. It ends in `ROLLBACK;` — no rows actually delete.
--     • Inspect the "AFTER" row counts at the bottom. The 3 preserved
--       bookings should still exist; everything else should be 0 or
--       only contain rows tied to those bookings.
--
--   STEP 2 (COMMIT — actually deletes):
--     • If the dry-run looked right, change the final line from
--       `ROLLBACK;` to `COMMIT;` and run again.
--
-- WHAT'S PRESERVED:
--   • The 3 named bookings + all their child rows
--     (payments, deposits, addons, agreements, status logs, check-in
--      records, incidentals, invoices, tolls, disputes, damage reports)
--   • The customer rows attached to those 3 bookings
--   • Vehicles, vehicle_deposits, email_templates, pricing_rules,
--     admin_profiles (configuration & inventory — not customer data)
--
-- WHAT'S WIPED:
--   • All other bookings + customers + their dependent rows
--   • messages, notifications, monthly_inquiries, webhook_failures
--     (these have no relationship to specific bookings)
--   • blocked_dates (commented out — uncomment if you want it cleared)
--   • reviews (commented out — uncomment if you want it cleared)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Capture the 3 bookings + their customer ids in a temp table.
--    Aborts immediately if any of the codes don't exist (typo guard).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _preserved_bookings AS
SELECT id, customer_id, booking_code
FROM bookings
WHERE booking_code IN (
  'BK-20260412-4MZB',
  'BK-20260415-5WHS',
  'BK-20260423-BU6L'
);

DO $$
DECLARE n int;
BEGIN
  SELECT COUNT(*) INTO n FROM _preserved_bookings;
  IF n <> 3 THEN
    RAISE EXCEPTION 'Expected 3 preserved bookings, found %. Aborting — none of the deletes ran.', n;
  END IF;
  RAISE NOTICE 'Preservation set verified: 3 bookings.';
END $$;

-- ---------------------------------------------------------------------------
-- 2. BEFORE row counts (for reference)
-- ---------------------------------------------------------------------------
SELECT 'BEFORE' AS phase, 'bookings'             AS table_name, COUNT(*) AS rows FROM bookings
UNION ALL SELECT 'BEFORE', 'customers',           COUNT(*) FROM customers
UNION ALL SELECT 'BEFORE', 'payments',            COUNT(*) FROM payments
UNION ALL SELECT 'BEFORE', 'rental_agreements',   COUNT(*) FROM rental_agreements
UNION ALL SELECT 'BEFORE', 'booking_status_log',  COUNT(*) FROM booking_status_log
UNION ALL SELECT 'BEFORE', 'booking_deposits',    COUNT(*) FROM booking_deposits
UNION ALL SELECT 'BEFORE', 'booking_addons',      COUNT(*) FROM booking_addons
UNION ALL SELECT 'BEFORE', 'checkin_records',     COUNT(*) FROM checkin_records
UNION ALL SELECT 'BEFORE', 'incidentals',         COUNT(*) FROM incidentals
UNION ALL SELECT 'BEFORE', 'invoices',            COUNT(*) FROM invoices
UNION ALL SELECT 'BEFORE', 'toll_charges',        COUNT(*) FROM toll_charges
UNION ALL SELECT 'BEFORE', 'customer_disputes',   COUNT(*) FROM customer_disputes
UNION ALL SELECT 'BEFORE', 'damage_reports',      COUNT(*) FROM damage_reports
UNION ALL SELECT 'BEFORE', 'messages',            COUNT(*) FROM messages
UNION ALL SELECT 'BEFORE', 'notifications',       COUNT(*) FROM notifications
UNION ALL SELECT 'BEFORE', 'monthly_inquiries',   COUNT(*) FROM monthly_inquiries
UNION ALL SELECT 'BEFORE', 'webhook_failures',    COUNT(*) FROM webhook_failures
UNION ALL SELECT 'BEFORE', 'blocked_dates',       COUNT(*) FROM blocked_dates
UNION ALL SELECT 'BEFORE', 'reviews',             COUNT(*) FROM reviews;

-- ---------------------------------------------------------------------------
-- 3. Delete child rows whose booking is NOT in the preserved set.
--    Order matters for FK chains.
-- ---------------------------------------------------------------------------
DELETE FROM checkin_records     WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM customer_disputes   WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM invoices            WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM incidentals         WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM toll_charges        WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM damage_reports      WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM booking_addons      WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM booking_deposits    WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM rental_agreements   WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM booking_status_log  WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);
DELETE FROM payments            WHERE booking_id NOT IN (SELECT id FROM _preserved_bookings);

-- ---------------------------------------------------------------------------
-- 4. Delete every booking that isn't preserved.
-- ---------------------------------------------------------------------------
DELETE FROM bookings WHERE id NOT IN (SELECT id FROM _preserved_bookings);

-- ---------------------------------------------------------------------------
-- 5. Wholesale wipes — these tables aren't keyed to specific bookings.
-- ---------------------------------------------------------------------------
DELETE FROM messages;
DELETE FROM notifications;
DELETE FROM monthly_inquiries;
DELETE FROM webhook_failures;

-- Optional — uncomment if you also want these cleared.
-- Reviews show on the public fleet page; if you've seeded test reviews
-- you'll want to wipe; if real customers have reviewed, leave commented.
-- DELETE FROM reviews;

-- Blocked dates are admin-set vehicle availability holds. Wipe only if you
-- want a totally clean calendar (any maintenance/vacation holds will go too).
-- DELETE FROM blocked_dates;

-- ---------------------------------------------------------------------------
-- 6. Delete every customer who isn't attached to a preserved booking.
-- ---------------------------------------------------------------------------
DELETE FROM customers
WHERE id NOT IN (
  SELECT customer_id FROM _preserved_bookings WHERE customer_id IS NOT NULL
);

-- ---------------------------------------------------------------------------
-- 7. AFTER row counts (sanity check)
-- ---------------------------------------------------------------------------
SELECT 'AFTER'  AS phase, 'bookings'             AS table_name, COUNT(*) AS rows FROM bookings
UNION ALL SELECT 'AFTER',  'customers',           COUNT(*) FROM customers
UNION ALL SELECT 'AFTER',  'payments',            COUNT(*) FROM payments
UNION ALL SELECT 'AFTER',  'rental_agreements',   COUNT(*) FROM rental_agreements
UNION ALL SELECT 'AFTER',  'booking_status_log',  COUNT(*) FROM booking_status_log
UNION ALL SELECT 'AFTER',  'booking_deposits',    COUNT(*) FROM booking_deposits
UNION ALL SELECT 'AFTER',  'booking_addons',      COUNT(*) FROM booking_addons
UNION ALL SELECT 'AFTER',  'checkin_records',     COUNT(*) FROM checkin_records
UNION ALL SELECT 'AFTER',  'incidentals',         COUNT(*) FROM incidentals
UNION ALL SELECT 'AFTER',  'invoices',            COUNT(*) FROM invoices
UNION ALL SELECT 'AFTER',  'toll_charges',        COUNT(*) FROM toll_charges
UNION ALL SELECT 'AFTER',  'customer_disputes',   COUNT(*) FROM customer_disputes
UNION ALL SELECT 'AFTER',  'damage_reports',      COUNT(*) FROM damage_reports
UNION ALL SELECT 'AFTER',  'messages',            COUNT(*) FROM messages
UNION ALL SELECT 'AFTER',  'notifications',       COUNT(*) FROM notifications
UNION ALL SELECT 'AFTER',  'monthly_inquiries',   COUNT(*) FROM monthly_inquiries
UNION ALL SELECT 'AFTER',  'webhook_failures',    COUNT(*) FROM webhook_failures
UNION ALL SELECT 'AFTER',  'blocked_dates',       COUNT(*) FROM blocked_dates
UNION ALL SELECT 'AFTER',  'reviews',             COUNT(*) FROM reviews;

-- Confirm the 3 bookings still exist with their codes
SELECT booking_code, status, pickup_date, return_date
FROM bookings
ORDER BY pickup_date;

-- ---------------------------------------------------------------------------
-- DEFAULT: ROLLBACK so the dry run leaves the database untouched.
-- Change to COMMIT once the AFTER counts look right.
-- ---------------------------------------------------------------------------
ROLLBACK;
-- COMMIT;
