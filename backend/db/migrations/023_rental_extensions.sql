-- 023_rental_extensions.sql
-- Customer-initiated rental extensions.
--
-- Lets an active-rental customer add days through the portal, pay for the extra
-- days via Stripe, and have the booking's return_date / rental_days / totals
-- updated automatically. Each extension is recorded here for audit + so the
-- back-office dashboard can surface a per-booking extension history.
--
-- Apply via Supabase SQL editor (idempotent — uses IF NOT EXISTS guards).
--
-- NOTE: payments.payment_type is a free-form VARCHAR(30) (no CHECK constraint),
-- so the paid extension is also written to `payments` with payment_type
-- 'extension' — no schema change required for that ledger row.

CREATE TABLE IF NOT EXISTS rental_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Snapshot of the change
  previous_return_date date NOT NULL,
  new_return_date date NOT NULL,
  additional_days int NOT NULL CHECK (additional_days > 0),
  daily_rate numeric(10,2) NOT NULL,

  -- Money (stored in cents for exactness)
  subtotal_cents int NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents int NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  amount_cents int NOT NULL CHECK (amount_cents > 0),

  -- Lifecycle: pending_payment -> (paid | failed | cancelled)
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'failed', 'cancelled')),

  payment_intent_id text,
  created_by text NOT NULL DEFAULT 'customer',   -- 'customer' | 'admin:<id>'
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_rental_extensions_booking
  ON rental_extensions (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rental_extensions_pi
  ON rental_extensions (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;
