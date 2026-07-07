-- Long-term / portal-managed rentals
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rental_type VARCHAR(20) NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS portal_notes TEXT;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_rental_type_values;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_rental_type_values
  CHECK (rental_type IN ('standard', 'long_term'));

CREATE INDEX IF NOT EXISTS bookings_rental_type_idx
  ON bookings(rental_type)
  WHERE rental_type = 'long_term';

COMMENT ON COLUMN bookings.rental_type IS 'standard = short-term; long_term = managed via admin Portal section';
COMMENT ON COLUMN bookings.portal_notes IS 'Internal notes for long-term renters (admin only)';
