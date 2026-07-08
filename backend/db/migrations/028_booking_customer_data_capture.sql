-- Migration 028: Persist delivery type, license scan metadata, customer receipt, and normalize add-on rows.
-- Run in Supabase SQL editor for Annie's Car Rental.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(30) DEFAULT 'pickup';

COMMENT ON COLUMN bookings.delivery_type IS 'pickup | psl_delivery | surrounding_delivery';

ALTER TABLE rental_agreements
  ADD COLUMN IF NOT EXISTS license_scan_metadata JSONB;

COMMENT ON COLUMN rental_agreements.license_scan_metadata IS
  'License scan audit: scan_id, method, scanned_at, name_match, photo_path, scanned_name';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS customer_receipt_snapshot JSONB;

COMMENT ON COLUMN bookings.customer_receipt_snapshot IS
  'Frozen itemized receipt the customer confirmed at checkout (line items, insurance, deposit, grand total)';

-- Backfill delivery_type from special_requests text where possible.
UPDATE bookings
SET delivery_type = CASE
  WHEN special_requests ILIKE '%Delivery type: psl_delivery%' THEN 'psl_delivery'
  WHEN special_requests ILIKE '%Delivery type: surrounding_delivery%' THEN 'surrounding_delivery'
  ELSE COALESCE(delivery_type, 'pickup')
END
WHERE delivery_type IS NULL OR delivery_type = 'pickup';

UPDATE bookings
SET has_delivery = COALESCE(delivery_requested, false)
WHERE has_delivery IS DISTINCT FROM COALESCE(delivery_requested, false);

UPDATE bookings
SET has_unlimited_miles = COALESCE(unlimited_miles, false)
WHERE has_unlimited_miles IS DISTINCT FROM COALESCE(unlimited_miles, false);

UPDATE bookings
SET has_unlimited_tolls = COALESCE(unlimited_tolls, false)
WHERE has_unlimited_tolls IS DISTINCT FROM COALESCE(unlimited_tolls, false);
