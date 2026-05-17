-- Migration 023: Web Push subscriptions
-- Sprint 12a (2026-05-17)
--
-- Stores PushManager subscriptions from customer portal home-screen-installed
-- PWAs. iOS 16.4+ supports web push only AFTER the user adds the site to
-- their home screen and grants notification permission. Android Chrome /
-- desktop Chrome / Firefox / Edge all support it directly.
--
-- A single customer may have multiple subscriptions (different devices,
-- different browsers). We dedupe on (customer_id, endpoint) so reinstalling
-- the PWA on the same browser updates the existing row.
--
-- Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- PushSubscription fields (W3C Web Push spec)
  endpoint        TEXT NOT NULL,
  keys_p256dh     TEXT NOT NULL,   -- base64url client public key
  keys_auth       TEXT NOT NULL,   -- base64url client auth secret

  -- Operational metadata
  user_agent      TEXT,            -- for debugging / device identification
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,     -- updated when a push is successfully delivered
  failed_count    INT NOT NULL DEFAULT 0,  -- consecutive failures; prune at 3+

  -- One row per (customer, browser endpoint). Browsers may rotate endpoints
  -- if the user clears site data — that creates a new row, the old one
  -- eventually gets pruned by failure counter.
  UNIQUE (customer_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_customer_idx
  ON push_subscriptions (customer_id);

-- Cleanup helper: rows that haven't been used in 6 months AND have failed
-- repeatedly are stale (browser subscription dropped). Manual prune query:
--   DELETE FROM push_subscriptions
--   WHERE failed_count >= 3
--     AND (last_used_at IS NULL OR last_used_at < now() - interval '6 months');

COMMENT ON TABLE push_subscriptions IS
  'Web Push (W3C PushManager) subscriptions for customer portal home-screen installs. Sprint 12a.';
