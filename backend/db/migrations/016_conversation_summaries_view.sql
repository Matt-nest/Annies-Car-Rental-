-- ============================================================================
-- Migration 016 — conversation summaries view
-- ============================================================================
-- Purpose: replace the 1000-message scan + JS grouping in
-- GET /messaging/conversations with a server-side DISTINCT ON view.
-- Output is bounded by customer count instead of message volume — won't
-- regress as the messages table grows. Phase 1 audit F-10.
--
-- Apply via: paste into Supabase SQL Editor, run, verify with the queries
-- at the bottom.
-- ============================================================================

CREATE OR REPLACE VIEW v_conversation_summaries AS
SELECT DISTINCT ON (customer_id)
  customer_id,
  body         AS last_message,
  direction    AS last_direction,
  channel      AS last_channel,
  created_at   AS last_at
FROM messages
WHERE customer_id IS NOT NULL
ORDER BY customer_id, created_at DESC;

-- Helpful index if not already present — the existing messages table almost
-- certainly has one, but we add the conditional create just in case.
CREATE INDEX IF NOT EXISTS idx_messages_customer_created
  ON messages (customer_id, created_at DESC);

-- ── Verification queries ────────────────────────────────────────────────────
--
-- 1. Row count — should equal the number of distinct customers with messages:
--    SELECT COUNT(*) FROM v_conversation_summaries;
--    SELECT COUNT(DISTINCT customer_id) FROM messages WHERE customer_id IS NOT NULL;
--    -- These two numbers must match.
--
-- 2. Spot-check a recent conversation:
--    SELECT * FROM v_conversation_summaries
--    ORDER BY last_at DESC LIMIT 5;
