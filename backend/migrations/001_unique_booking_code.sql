-- Add UNIQUE constraint to booking_code column
-- This prevents duplicate booking codes at the database level (defense in depth)
-- The application already retries code generation, but this is a safety net

ALTER TABLE bookings ADD CONSTRAINT unique_booking_code UNIQUE (booking_code);

-- Verify the constraint was added
-- SELECT conname FROM pg_constraint WHERE conrelid = 'bookings'::regclass AND contype = 'u';
