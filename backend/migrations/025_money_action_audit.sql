-- 025_money_action_audit.sql
-- Durable operator audit trail for dashboard money actions.

CREATE TABLE IF NOT EXISTS money_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key text NOT NULL,
  title text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'completed',
  actor_id text,
  actor_email text,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  deposit_id uuid REFERENCES booking_deposits(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  plan_id uuid,
  installment_id uuid,
  amount_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_money_action_audit_created
  ON money_action_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_money_action_audit_booking
  ON money_action_audit (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_money_action_audit_customer
  ON money_action_audit (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_money_action_audit_action
  ON money_action_audit (action_key, created_at DESC);

ALTER TABLE money_action_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages money action audit"
  ON money_action_audit
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
