-- Admin approval workflow: high-risk flag at approve time
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_high_risk boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN bookings.is_high_risk IS
  'Set by admin when approving a booking. May trigger an elevated security deposit.';
