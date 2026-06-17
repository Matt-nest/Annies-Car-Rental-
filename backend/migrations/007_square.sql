-- 007_square.sql
-- Square payment processor support (Annie's clone). Additive and non-destructive:
-- runs alongside the existing Stripe columns so PAYMENT_PROVIDER can flip between
-- 'stripe' and 'square' without data loss. None of these are used until the
-- backend env sets PAYMENT_PROVIDER=square.
--
-- Apply via Supabase SQL editor (idempotent — uses IF NOT EXISTS guards).

-- ── Customer-level Square identity (parallel to stripe_customer_id) ──────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS square_customer_id text UNIQUE;

-- ── Booking-level saved card-on-file (Square card id, parallel to stripe_payment_method_id)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS square_card_id text;

-- ── Receipt idempotency lock ─────────────────────────────────────────────────
-- Stripe stored this in PaymentIntent metadata; Square has no updatable payment
-- metadata, so the "receipt already sent" lock lives on the booking row.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz;

-- ── Deposit settlement: Square payment id (parallel to stripe_charge_id) ─────
ALTER TABLE booking_deposits ADD COLUMN IF NOT EXISTS square_payment_id text;

-- Note: pending_overage_charges.payment_intent_id is reused to store the Square
-- payment id for off-session overage charges (provider-agnostic reference).
-- payments.method ('square') + payments.reference_id (Square payment id) need no
-- schema change — both columns are already free-form text.
