-- ============================================================================
-- Migration 021 — Voice hunt group + voicemail config
-- ============================================================================
-- Purpose: extend business_settings (migration 018) with the configuration
-- needed for inbound voice handling on +17722071655. The backend
-- routes/voice.js reads these columns to build dynamic TwiML on each call,
-- so admin edits in the Settings UI take effect on the next inbound call —
-- no Twilio Console trips, no env-var redeploy.
--
-- hunt_group_members JSONB schema:
--   [
--     { "name": "Aaron", "phone": "+17729856667", "ring_seconds": 30, "enabled": true },
--     { "name": "Robin", "phone": "+17728347637", "ring_seconds": 30, "enabled": true },
--     { "name": "Dylan", "phone": "+17722335488", "ring_seconds": 30, "enabled": true }
--   ]
--
-- Fallback policy when no member answers:
--   'voicemail'           — record a message, email it to voicemail_email
--   'voicemail_textback'  — record AND text the caller "we missed you, calling back"
--   'hangup'              — just disconnect (worst UX, not recommended)
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS hunt_group_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hunt_group_members  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hunt_group_fallback TEXT        NOT NULL DEFAULT 'voicemail_textback',
  ADD COLUMN IF NOT EXISTS voicemail_email     TEXT,
  ADD COLUMN IF NOT EXISTS voicemail_greeting  TEXT;

-- Fallback policy enum
DO $$ BEGIN
  ALTER TABLE business_settings
    ADD CONSTRAINT business_settings_hunt_fallback_chk
    CHECK (hunt_group_fallback IN ('voicemail','voicemail_textback','hangup'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill with the initial hunt group order specified by Matt (2026-05-13):
-- Aaron first (primary cell), then Robin, then Dylan. 30s per leg = 90s total
-- before falling through to voicemail. voicemail_textback default is best UX
-- per customer/admin experience trade-off.
UPDATE business_settings SET
  hunt_group_enabled = TRUE,
  hunt_group_members = '[
    {"name": "Aaron", "phone": "+17729856667", "ring_seconds": 30, "enabled": true},
    {"name": "Robin", "phone": "+17728347637", "ring_seconds": 30, "enabled": true},
    {"name": "Dylan", "phone": "+17722335488", "ring_seconds": 30, "enabled": true}
  ]'::jsonb,
  hunt_group_fallback = 'voicemail_textback',
  voicemail_email = 'aaron@anniescarrental.com',
  voicemail_greeting = 'Hi, you have reached Annie''s Car Rental in Port Saint Lucie. We are not available right now. Please leave your name and number after the beep and we will call you back as soon as possible. Thanks for calling.'
WHERE id = 1
  AND (hunt_group_enabled = FALSE OR hunt_group_members = '[]'::jsonb);
-- ↑ idempotent: only overwrites the seed values, won't clobber later admin edits

-- ────────────────────────────────────────────────────────────────────────────
-- Verification queries
-- ────────────────────────────────────────────────────────────────────────────
--
-- 1. Confirm columns exist + hunt group seeded:
--    SELECT hunt_group_enabled, jsonb_array_length(hunt_group_members) AS members,
--           hunt_group_fallback, voicemail_email
--    FROM business_settings WHERE id = 1;
--    -- expect: true, 3, 'voicemail_textback', 'aaron@anniescarrental.com'
--
-- 2. Inspect each member:
--    SELECT jsonb_array_elements(hunt_group_members) AS member
--    FROM business_settings WHERE id = 1;
