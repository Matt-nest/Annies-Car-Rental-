-- ============================================================================
-- Migration 026 — team SMS alert phones (admin ops notifications)
-- ============================================================================
-- Lets admins configure up to 4 E.164 phone numbers in business_settings so
-- the team receives concise internal SMS alerts for core booking events
-- (new booking pending approval, payment received, agreement signed, etc.).
--
-- Wired by:
--   - teamAlertService.js — reads config, fans out via Twilio (source: manual)
--   - GET/PUT /api/v1/settings/business — admin reads/writes team_alert_phones
--   - dashboard Settings → System → Team SMS Alerts
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS team_alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS team_alert_phones  JSONB   NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN business_settings.team_alerts_enabled IS
  'When true, core booking events fan out SMS to team_alert_phones.';
COMMENT ON COLUMN business_settings.team_alert_phones IS
  'JSON array of up to 4 E.164 US numbers (+1XXXXXXXXXX) for internal ops SMS.';
