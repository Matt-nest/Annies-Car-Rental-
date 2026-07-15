-- Optional booking audit columns used by late-return settlement and insurance review.
-- The API tolerates these missing in older production schemas, but new schemas should include them.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS late_return BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insurance_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS insurance_reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS insurance_review_reason TEXT;
