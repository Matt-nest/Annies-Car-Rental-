-- ============================================================================
-- Migration 000 — webhook_failures (failed webhook / notification attempts log)
-- ============================================================================
-- Read by GET /stats/webhook-failures (routes/stats.js) and the dashboard
-- WebhookFailuresPage. Append-only error log for outbound webhook/notification
-- failures (e.g. GHL automation). Historically created outside the migration
-- set on Annie's project — captured here so a fresh client DB builds cleanly.
-- Empty by default. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_failures (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type TEXT,                                 -- e.g. 'ghl', 'notification'
  event        TEXT,                                 -- stage / event name
  endpoint     TEXT,
  payload      JSONB,
  error_text   TEXT,
  status_code  INTEGER,
  booking_id   UUID REFERENCES bookings(id) ON DELETE SET NULL,
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_created ON webhook_failures (created_at DESC);

ALTER TABLE webhook_failures ENABLE ROW LEVEL SECURITY;
