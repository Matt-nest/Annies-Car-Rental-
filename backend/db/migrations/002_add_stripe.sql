-- Add stripe_payment_intent_id to bookings table
-- This stores the Stripe PaymentIntent ID for each booking so we can
-- retrieve existing intents (idempotent) and link webhook events.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
