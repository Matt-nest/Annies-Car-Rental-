-- Migration 024: Admin push subscriptions
-- Sprint 18 (2026-05-21)
--
-- Stores PushManager subscriptions from the DASHBOARD PWA when admins
-- (owner / admin / staff / viewer) opt in to web push. Mirrors the customer
-- push_subscriptions table (migration 023) but FKs to admin_profiles instead.
--
-- Why a separate table:
--   • Different role gating — admin push routes use requireAuth (Supabase
--     session token), customer routes use requirePortalAuth (portal JWT).
--   • Different lifecycle — admin pushes are op-critical events (new booking,
--     damage report filed); customer pushes are confirmations.
--   • Cleaner FK semantics — customer_id is NOT NULL with cascade on the
--     customer table; mixing admin_user_id into the same row would require
--     making customer_id nullable + adding a check constraint, which is
--     uglier than a parallel table.
--
-- Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES admin_profiles(id) ON DELETE CASCADE,

  -- PushSubscription fields (W3C Web Push spec)
  endpoint        TEXT NOT NULL,
  keys_p256dh     TEXT NOT NULL,   -- base64url client public key
  keys_auth       TEXT NOT NULL,   -- base64url client auth secret

  -- Operational metadata
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  failed_count    INT NOT NULL DEFAULT 0,

  -- One row per (admin, browser endpoint). Reinstalling the PWA on the same
  -- browser updates the existing row instead of duplicating.
  UNIQUE (admin_user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS admin_push_subscriptions_admin_idx
  ON admin_push_subscriptions (admin_user_id);

COMMENT ON TABLE admin_push_subscriptions IS
  'Web Push (W3C PushManager) subscriptions for admin/staff dashboard PWA installs. Sprint 18.';
