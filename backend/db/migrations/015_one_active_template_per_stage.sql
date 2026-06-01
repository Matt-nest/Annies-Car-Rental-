-- ============================================================================
-- Migration 015 — one active email_template per stage
-- ============================================================================
-- Purpose: prevent the case where two templates share a stage with
-- is_active=true. getRenderedTemplate calls
--   .eq('stage', stage).eq('is_active', true).single()
-- which throws when more than one row matches → falls through to the
-- hardcoded fallback template silently. Phase 1 audit F-18.
--
-- Two-step migration:
--   1. Cleanup any existing duplicates: keep the row with the most recent
--      updated_at (or created_at as tie-breaker) as active, deactivate the rest.
--   2. Add the partial unique index so future inserts/updates are blocked
--      by Postgres at write time.
--
-- Apply via: paste into Supabase SQL Editor, run, verify with the queries
-- at the bottom.
-- ============================================================================

-- ── Step 1: Deactivate older duplicates ────────────────────────────────────
-- For each stage that has multiple is_active=true rows, keep only the
-- most-recently-updated one as active.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY stage
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM email_templates
  WHERE is_active = TRUE
)
UPDATE email_templates et
SET is_active = FALSE,
    updated_at = COALESCE(et.updated_at, NOW())
FROM ranked r
WHERE et.id = r.id AND r.rn > 1;

-- ── Step 2: Enforce the constraint going forward ────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_one_active_per_stage
  ON email_templates (stage)
  WHERE is_active = TRUE;

-- ── Verification queries ────────────────────────────────────────────────────
--
-- 1. Confirm at most one active per stage (expect 0 violating rows):
--    SELECT stage, COUNT(*) FROM email_templates
--    WHERE is_active = TRUE
--    GROUP BY stage
--    HAVING COUNT(*) > 1;
--
-- 2. Confirm the index exists:
--    SELECT indexname FROM pg_indexes
--    WHERE tablename = 'email_templates'
--      AND indexname = 'idx_email_templates_one_active_per_stage';
--
-- 3. Confirm the constraint blocks duplicates (should error with 23505):
--    -- Pick a stage that already has an active template and try to activate another:
--    -- INSERT INTO email_templates (stage, name, is_active, subject, body, channel)
--    -- VALUES ('booking_approved', 'Test Dup', true, 's', 'b', 'email');
