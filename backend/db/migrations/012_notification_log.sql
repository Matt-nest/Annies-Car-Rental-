-- ============================================================================
-- Migration 012 — notification idempotency log
-- ============================================================================
-- Purpose: prevent double-fire of automated notifications when crons retry,
-- get manually replayed, or run after redeploy. Phase 1 audit F-7.
--
-- Before this migration: cron stages (pickup_reminder, return_reminder,
-- late_return_warning, mid_rental_checkin, extension_offer, rental_completed,
-- repeat_customer, late_return_escalation) fire on every cron invocation
-- with no per-booking-per-stage tracking. Manual replays double-text customers.
--
-- After this migration: sendBookingNotification(stage, payload) inserts a row
-- before dispatch. The unique constraint (booking_code, stage, event_date)
-- forces dedup. Duplicate inserts return Postgres 23505 — caller skips.
--
-- Apply via: paste into Supabase SQL Editor, run, verify with the queries
-- at the bottom.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code  TEXT NOT NULL,
  stage         TEXT NOT NULL,
  event_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_code, stage, event_date)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_lookup
  ON notification_log (booking_code, stage, event_date);

-- ── Backfill from existing messages table ───────────────────────────────────
-- Every system notification stored a row in `messages` with
-- metadata = { stage, automated: true, booking_code }. We seed the log from
-- those so the first cron run after deploy doesn't re-fire historical
-- reminders that already went out.
--
-- ON CONFLICT DO NOTHING handles same-day duplicates that may already exist
-- in the messages table (the very bug we're now fixing).

INSERT INTO notification_log (booking_code, stage, event_date, sent_at)
SELECT
  m.metadata->>'booking_code'      AS booking_code,
  m.metadata->>'stage'             AS stage,
  m.created_at::date               AS event_date,
  MIN(m.created_at)                AS sent_at
FROM messages m
WHERE m.metadata->>'automated' = 'true'
  AND COALESCE(m.metadata->>'stage', '')        <> ''
  AND COALESCE(m.metadata->>'booking_code', '') <> ''
GROUP BY
  m.metadata->>'booking_code',
  m.metadata->>'stage',
  m.created_at::date
ON CONFLICT (booking_code, stage, event_date) DO NOTHING;

-- ── Verification queries (run after migration) ──────────────────────────────
--
-- 1. Row count seeded:
--    SELECT COUNT(*) FROM notification_log;
--
-- 2. Spot-check a recent stage:
--    SELECT booking_code, stage, event_date, sent_at
--    FROM notification_log
--    WHERE event_date >= CURRENT_DATE - INTERVAL '7 days'
--    ORDER BY sent_at DESC
--    LIMIT 20;
--
-- 3. Confirm the unique constraint blocks duplicates (should error 23505):
--    INSERT INTO notification_log (booking_code, stage)
--    SELECT booking_code, stage FROM notification_log LIMIT 1;
