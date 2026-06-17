-- 008_customer_accounts.sql
-- Customer portal accounts (admin-provisioned) + recurring long-term rentals.
-- Additive and idempotent (IF NOT EXISTS guards). Safe to run alongside the
-- existing schema — nothing here is read until the account-portal code ships.
--
-- Apply via Supabase SQL editor against project yrerxvuyeglrypeufjpy
-- (NOT the MCP's asdhn… project — see project_supabase_mcp_project_mismatch).

-- ── Customer portal credentials (admin-provisioned login) ────────────────────
-- One login per customer. Username = FirstName + Last initial (deduped).
-- Password starts as the customer's phone number; must_change_password forces a
-- reset on first login. Hash format: "scrypt$<salt>$<derived>" (Node crypto).
CREATE TABLE IF NOT EXISTS customer_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  username              text NOT NULL UNIQUE,
  password_hash         text NOT NULL,
  must_change_password  boolean NOT NULL DEFAULT true,
  status                text NOT NULL DEFAULT 'active',  -- active | disabled
  last_login_at         timestamptz,
  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
-- One account per customer
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_customer ON customer_accounts(customer_id);
-- Case-insensitive username lookups at login
CREATE INDEX IF NOT EXISTS idx_customer_accounts_username_lower ON customer_accounts(lower(username));

-- ── Customer profile photo ───────────────────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url text;

-- ── Invoice paid timestamp (portal self-pay marks this) ──────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- ── Long-term rental flag on bookings ────────────────────────────────────────
-- 'standard' = normal per-trip booking (state machine unchanged).
-- 'long_term' = backing booking for a recurring rental (skips approval/checkin).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rental_type text NOT NULL DEFAULT 'standard';

-- ── Recurring rentals (the subscription) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_rentals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id              uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  booking_id              uuid REFERENCES bookings(id) ON DELETE SET NULL,
  status                  text NOT NULL DEFAULT 'active',        -- active | paused | past_due | cancelled
  amount                  numeric(10,2) NOT NULL,
  interval                text NOT NULL DEFAULT 'monthly',       -- weekly | biweekly | monthly
  interval_count          int  NOT NULL DEFAULT 1,
  billing_anchor_day      int,                                   -- day-of-month (monthly) or day-of-week (weekly)
  collection_method       text NOT NULL DEFAULT 'auto_charge',   -- auto_charge | send_link
  square_customer_id      text,
  square_card_id          text,                                  -- saved card autopay charges
  square_payment_link_id  text,
  square_payment_link_url text,
  start_date              date NOT NULL DEFAULT current_date,
  next_charge_date        date NOT NULL,
  max_charge_attempts     int  NOT NULL DEFAULT 3,
  notes                   text,
  created_by              uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  cancelled_at            timestamptz
);
CREATE INDEX IF NOT EXISTS idx_recurring_rentals_customer ON recurring_rentals(customer_id);
-- Cron worker pulls active plans that are due
CREATE INDEX IF NOT EXISTS idx_recurring_rentals_due ON recurring_rentals(next_charge_date) WHERE status = 'active';

-- ── Recurring charge ledger (one row per billing cycle) ──────────────────────
CREATE TABLE IF NOT EXISTS recurring_charges (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_rental_id  uuid NOT NULL REFERENCES recurring_rentals(id) ON DELETE CASCADE,
  period_start         date NOT NULL,
  period_end           date NOT NULL,
  amount               numeric(10,2) NOT NULL,
  due_date             date NOT NULL,
  status               text NOT NULL DEFAULT 'scheduled',  -- scheduled | paid | failed | past_due | skipped
  square_payment_id    text,
  attempts             int  NOT NULL DEFAULT 0,
  last_attempt_at      timestamptz,
  paid_at              timestamptz,
  failure_reason       text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recurring_charges_rental ON recurring_charges(recurring_rental_id);
-- One charge row per period — lets the cron worker be idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_charges_period ON recurring_charges(recurring_rental_id, period_start);
