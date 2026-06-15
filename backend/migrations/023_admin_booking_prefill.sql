-- 023_admin_booking_prefill.sql
-- Lets an admin pre-fill agreement details (license, address, DOB, ID photos,
-- optional in-person signature) when creating a booking from the dashboard.
-- Whatever the admin captures is stored here; GET /agreements/:code overlays it
-- onto customerDefaults and returns `prefilled_steps` so the customer's
-- continue-booking link can skip the steps the admin already completed.
--
-- Stored shape (all keys optional — only what the admin actually filled):
-- {
--   "address":  { "line1": "...", "city": "...", "state": "..", "zip": "....." },
--   "dob": "YYYY-MM-DD",
--   "license":  { "number": "...", "state": "..", "expiry": "YYYY-MM-DD" },
--   "license_photo_paths": ["ids/uuid.jpg", ...],
--   "signature": { "data": "data:image/png;base64,...", "type": "drawn|typed" },
--   "steps": ["scan", "license", "address", "signature"]
-- }
--
-- Deliberately NOT written into rental_agreements: that table is one-row-per
-- booking and the customer's POST /agreements/:code/sign treats any existing
-- row as "already signed". Keeping the pre-fill on the booking preserves that
-- invariant — the real agreement row is still created when the customer signs.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS admin_prefill JSONB;

COMMENT ON COLUMN bookings.admin_prefill IS
  'Admin-entered agreement pre-fill (license/address/dob/id-photos/signature + completed step keys). Surfaced via GET /agreements/:code as customerDefaults + prefilled_steps so the customer link skips filled steps. Null for customer-originated bookings.';
