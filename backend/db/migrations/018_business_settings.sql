-- ============================================================================
-- Migration 018 — business_settings (singleton) + sms_opt_out_log (audit trail)
-- ============================================================================
-- Purpose: support the admin-controlled SMS guardrails introduced in Phase 1.
--
--   1. business_settings — single-row config for quiet hours (start/end/timezone)
--      and quiet-hours policy ('skip' = drop SMS, 'defer' = future enhancement).
--      Singleton enforced by `id = 1` CHECK constraint (matches the pattern used
--      by bouncie_credentials in migration 017).
--
--   2. sms_opt_out_log — append-only audit trail for opt-out / opt-in events
--      so we can show admins who opted a customer back in (and when), and
--      defend against TCPA disputes. Captures: keyword opt-outs (STOP/UNSUB),
--      admin-initiated opt-outs/ins, and customer-portal-initiated events.
--
-- This migration is the foundation for:
--   - notifyService.js#sendSMS — checks quiet hours before calling Twilio
--   - GET/PUT /api/v1/settings/business — admin reads/writes the config
--   - GET /api/v1/customers/sms-opt-outs + POST /api/v1/customers/:id/sms-opt-in
--   - MessagingPage → Opt-Outs tab
--
-- Safe to re-run. No existing data is altered.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. business_settings (singleton)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_settings (
  id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- SMS quiet hours
  quiet_hours_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
  quiet_hours_start     TIME        NOT NULL DEFAULT '21:00',
  quiet_hours_end       TIME        NOT NULL DEFAULT '08:00',
  quiet_hours_timezone  TEXT        NOT NULL DEFAULT 'America/New_York',
  quiet_hours_policy    TEXT        NOT NULL DEFAULT 'skip'
    CHECK (quiet_hours_policy IN ('skip','defer')),

  -- Bookkeeping
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID                                 -- staff user_id from last edit
);

-- Seed the singleton row. Idempotent — ON CONFLICT preserves existing values
-- if this migration is re-applied after the admin has tweaked settings.
INSERT INTO business_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. sms_opt_out_log — append-only audit trail
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_opt_out_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  action       TEXT NOT NULL CHECK (action IN ('opt_out','opt_in')),
  source       TEXT NOT NULL CHECK (source IN ('keyword','admin','customer_portal','backfill')),
  actor_id     UUID,                                          -- staff user_id when source='admin'
  note         TEXT,                                          -- e.g. "Customer called and asked back in"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_opt_out_log_customer
  ON sms_opt_out_log (customer_id, created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Backfill: every currently-opted-out customer gets a single 'backfill'
--    row so the admin view shows a sensible date for historical opt-outs.
--    Skips customers that already have a log row (idempotent re-run safety).
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO sms_opt_out_log (customer_id, action, source, note, created_at)
SELECT
  c.id,
  'opt_out',
  'backfill',
  'Pre-existing opt-out (no historical event captured)',
  COALESCE(c.sms_opt_out_at, now())
FROM customers c
WHERE c.sms_opt_out = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM sms_opt_out_log l
    WHERE l.customer_id = c.id
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually in the SQL Editor after applying)
-- ────────────────────────────────────────────────────────────────────────────
--
-- 1. Singleton row exists with sensible defaults:
--    SELECT * FROM business_settings;
--    -- expect 1 row, id=1, quiet_hours_enabled=true, '21:00'..'08:00' ET
--
-- 2. Constraint blocks a second row:
--    INSERT INTO business_settings (id) VALUES (2);
--    -- expect: ERROR: new row for relation "business_settings" violates check constraint
--
-- 3. Audit table empty for fresh installs, or backfilled for existing ones:
--    SELECT COUNT(*) FROM sms_opt_out_log;
--    -- compare against:
--    SELECT COUNT(*) FROM customers WHERE sms_opt_out = TRUE;
--    -- the log count should be ≥ the customer count (1 backfill row per customer minimum)
--
-- 4. Sample backfilled rows (if any exist):
--    SELECT l.created_at, l.action, l.source, c.email
--    FROM sms_opt_out_log l
--    JOIN customers c ON c.id = l.customer_id
--    ORDER BY l.created_at DESC LIMIT 10;
