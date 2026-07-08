-- Annie's Car Rental — purge test customers/bookings
-- Run in Supabase SQL Editor for project: yrerxvuyeglrypeufjpy
-- Preserves: BK-20260703-YRK9 (Michael STOVER)

BEGIN;

CREATE TEMP TABLE _purge_customers AS
SELECT id
FROM customers
WHERE (
  (lower(first_name) LIKE '%alain%' AND lower(last_name) LIKE '%lusma%')
  OR (lower(first_name) LIKE '%matthew%' AND lower(last_name) LIKE '%nestor%')
  OR (lower(first_name) LIKE '%aaron%' AND lower(last_name) LIKE '%daniel%')
  OR (lower(first_name) LIKE '%john%' AND lower(last_name) LIKE '%damiani%')
  OR (lower(first_name) LIKE '%cursor%' AND lower(last_name) LIKE '%test%')
  OR lower(email) LIKE '%alain%'
  OR lower(email) LIKE '%lusma%'
  OR lower(email) LIKE '%matthewnestor%'
  OR lower(email) LIKE '%damiani%'
  OR lower(email) LIKE '%cursortest%'
);

CREATE TEMP TABLE _purge_bookings AS
SELECT id, booking_code
FROM bookings
WHERE customer_id IN (SELECT id FROM _purge_customers)
  AND booking_code <> 'BK-20260703-YRK9';

-- Child tables
DELETE FROM checkin_records WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM customer_disputes WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM invoices WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM incidentals WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM toll_charges WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM damage_reports WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM booking_addons WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM booking_deposits WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM rental_agreements WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM booking_status_log WHERE booking_id IN (SELECT id FROM _purge_bookings);
DELETE FROM payments WHERE booking_id IN (SELECT id FROM _purge_bookings);

DELETE FROM messages WHERE customer_id IN (SELECT id FROM _purge_customers);
DELETE FROM bookings WHERE id IN (SELECT id FROM _purge_bookings);
DELETE FROM customers WHERE id IN (SELECT id FROM _purge_customers);

DELETE FROM notifications
WHERE lower(coalesce(title, '') || ' ' || coalesce(message, '')) LIKE '%alain%'
   OR lower(coalesce(title, '') || ' ' || coalesce(message, '')) LIKE '%lusma%'
   OR lower(coalesce(title, '') || ' ' || coalesce(message, '')) LIKE '%matthew nestor%'
   OR lower(coalesce(title, '') || ' ' || coalesce(message, '')) LIKE '%aaron%daniel%'
   OR lower(coalesce(title, '') || ' ' || coalesce(message, '')) LIKE '%john%damiani%'
   OR (metadata->>'booking_id') IN (SELECT id::text FROM _purge_bookings);

SELECT 'remaining_customers' AS label, count(*) AS n FROM customers
UNION ALL
SELECT 'remaining_bookings', count(*) FROM bookings;

COMMIT;
