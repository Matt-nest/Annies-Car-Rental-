-- Migration 011 — Checkout override audit columns
--
-- Admins should not be able to start the checkout flow until the renter has
-- self-checked-out via the customer portal (record_type='customer_checkout')
-- or the booking has organically reached status='returned'. When neither has
-- happened (vehicle physically back but customer never tapped "End trip" in
-- the portal), an admin may force-unlock checkout by selecting an override
-- reason. These columns persist that override for audit.
--
-- The override path also synthesizes a customer_checkout record (so the same
-- gate/UI logic that reads checkin_records keeps working downstream) and
-- stamps actual_return_at if it's null. Migration 010's terminal-return-date
-- invariant is preserved: any subsequent transition to 'returned'/'completed'
-- will continue to clamp return_date as needed.

BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS checkout_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS checkout_override_note   TEXT,
  ADD COLUMN IF NOT EXISTS checkout_override_by     TEXT,
  ADD COLUMN IF NOT EXISTS checkout_override_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_admin         BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN bookings.checkout_override_reason IS
  'One of: vehicle_returned_system_not_updated, renter_unreachable_or_abandoned, manual_reconciliation_after_incident, other';
COMMENT ON COLUMN bookings.checkout_override_note IS
  'Free-text note. Required when checkout_override_reason = ''other''.';
COMMENT ON COLUMN bookings.created_by_admin IS
  'TRUE when an admin created this booking on behalf of a customer via the dashboard New Booking modal. Used to auto-approve on payment success (the admin already vetted the request).';

COMMIT;
