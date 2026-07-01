-- 024_payment_plans.sql
-- Recurring / installment billing for long-term rentals.
--
-- A payment plan splits a booking's outstanding rental balance into scheduled
-- installments that are charged off-session against the card on file. Each paid
-- installment is also written to `payments` as a 'rental' row so it counts
-- toward the booking total + the portal balance everywhere.
--
-- Apply via Supabase SQL editor (idempotent — uses IF NOT EXISTS guards).
-- Requires a card on file (bookings.stripe_payment_method_id + the customer's
-- stripe_customer_id, added in migration 005) for automatic charging.

CREATE TABLE IF NOT EXISTS payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  interval text NOT NULL CHECK (interval IN ('weekly', 'biweekly', 'monthly')),
  installment_count int NOT NULL CHECK (installment_count > 0),
  total_cents int NOT NULL CHECK (total_cents > 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_booking
  ON payment_plans (booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sequence int NOT NULL,
  due_date date NOT NULL,
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  -- scheduled -> processing -> (paid | failed); cancelled when the plan is cancelled
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'processing', 'paid', 'failed', 'cancelled')),
  payment_intent_id text,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_installments_due
  ON payment_installments (due_date)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_payment_installments_plan
  ON payment_installments (plan_id, sequence);

CREATE INDEX IF NOT EXISTS idx_payment_installments_booking
  ON payment_installments (booking_id);
