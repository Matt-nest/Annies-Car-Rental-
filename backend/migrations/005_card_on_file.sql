-- 005_card_on_file.sql
-- Card-on-file persistence + automated overage charging infrastructure.
-- Enabled by env var FEATURE_AUTO_OVERAGE_CHARGES=true. Until that flag is on,
-- none of the new code paths fire and these columns/tables are unused.
--
-- Apply via Supabase SQL editor (idempotent — uses IF NOT EXISTS guards).

-- ── Customer-level Stripe identity ───────────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE;

-- ── Booking-level saved payment method (token, not full card data) ───────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS card_brand text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS card_last4 text;

-- ── Scheduled overage charges with 48-hour dispute window ────────────────────
CREATE TABLE IF NOT EXISTS pending_overage_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  description text NOT NULL,
  line_items jsonb,
  scheduled_for timestamptz NOT NULL,
  -- Lifecycle: pending → (disputed | processing) → (succeeded | failed | cancelled)
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'disputed', 'processing', 'succeeded', 'failed', 'cancelled')),
  dispute_message text,
  payment_intent_id text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pending_overage_due
  ON pending_overage_charges (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pending_overage_booking
  ON pending_overage_charges (booking_id);

-- ── Audit log: every state transition recorded for compliance ────────────────
CREATE TABLE IF NOT EXISTS pending_overage_charge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL REFERENCES pending_overage_charges(id) ON DELETE CASCADE,
  event text NOT NULL,         -- e.g. 'created', 'disputed', 'processed', 'failed', 'card_update_requested'
  detail jsonb,
  actor text,                  -- 'system' | 'admin:<id>' | 'customer'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_overage_charge_log_charge
  ON pending_overage_charge_log (charge_id, created_at DESC);
