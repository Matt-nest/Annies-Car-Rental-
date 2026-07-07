-- 025_admin_booking_prefill.sql
-- Lets an admin pre-fill agreement details when creating a booking from the dashboard.
-- GET /agreements/:code overlays this onto customerDefaults and returns prefilledSteps
-- so the customer's continue-booking link skips completed steps.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admin_prefill JSONB;

COMMENT ON COLUMN bookings.admin_prefill IS
  'Admin-entered agreement pre-fill (license/address/dob/id-photos + completed step keys). Surfaced via GET /agreements/:code. Null for customer-originated bookings.';
