-- Apply in Supabase SQL Editor for project yrerxvuyeglrypeufjpy (Annie's backend DB).
-- Fixes /push/subscribe 500 (missing push_subscriptions) + admin push (missing admin_push_subscriptions).
-- Idempotent: safe to re-run.

-- ── 023: customer push_subscriptions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  keys_p256dh     TEXT NOT NULL,
  keys_auth       TEXT NOT NULL,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  failed_count    INT NOT NULL DEFAULT 0,
  UNIQUE (customer_id, endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_customer_idx
  ON push_subscriptions (customer_id);

-- ── 024: admin_push_subscriptions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES admin_profiles(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  keys_p256dh     TEXT NOT NULL,
  keys_auth       TEXT NOT NULL,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  failed_count    INT NOT NULL DEFAULT 0,
  UNIQUE (admin_user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS admin_push_subscriptions_admin_idx
  ON admin_push_subscriptions (admin_user_id);

-- Force PostgREST to pick up the new tables immediately (clears PGRST205).
NOTIFY pgrst, 'reload schema';
