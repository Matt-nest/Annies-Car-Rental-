-- 024_pricing_overrides.sql
-- Admin rate + deposit override provenance for the New Booking / contract flow.
-- bookings.daily_rate and bookings.deposit_amount already exist; these flags only
-- record that an admin deviated from the vehicle's standard rate/deposit so the UI
-- can badge "custom rate". Backward-compatible, idempotent, additive.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rate_overridden    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_overridden BOOLEAN NOT NULL DEFAULT false;
