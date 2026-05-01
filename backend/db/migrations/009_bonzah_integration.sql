-- ============================================================
-- Migration 009: Bonzah Insurance Integration — Phase 1 Foundation
-- Annie's Car Rental
--
-- Adds:
--   1. Per-booking Bonzah columns (quote, policy, premium, markup, coverage, sync state)
--   2. bonzah_events audit table — every API call logged
--   3. settings k/v table — runtime-toggleable config (markup %, tier defs, kill switch)
--
-- Safe to re-run. Historical booking data is NOT altered.
-- bonzah_policy_id already exists from 001_initial_schema.sql — preserved unchanged.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Bonzah-specific booking columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE bookings
  -- The selected tier (essential | standard | complete) — references settings.bonzah_tiers[].id
  ADD COLUMN IF NOT EXISTS bonzah_tier_id TEXT,

  -- Bonzah-issued draft quote ID (returned from POST /Bonzah/quote with finalize:0)
  ADD COLUMN IF NOT EXISTS bonzah_quote_id TEXT,

  -- Human-readable policy number (e.g., BORD2024092401000009) — set after bind succeeds
  ADD COLUMN IF NOT EXISTS bonzah_policy_no TEXT,

  -- Money: tracked in cents to avoid float drift. premium = Bonzah's quote, markup = our cut.
  ADD COLUMN IF NOT EXISTS bonzah_premium_cents INTEGER,
  ADD COLUMN IF NOT EXISTS bonzah_markup_cents INTEGER,
  ADD COLUMN IF NOT EXISTS bonzah_total_charged_cents INTEGER,

  -- Snapshot of coverage selection + limits + deductibles at quote time (for dashboard display)
  ADD COLUMN IF NOT EXISTS bonzah_coverage_json JSONB,

  -- Internal 24h re-quote cutoff (Bonzah quotes never expire; we enforce a freshness window)
  ADD COLUMN IF NOT EXISTS bonzah_quote_expires_at TIMESTAMPTZ,

  -- Last successful poll against /Bonzah/policy — surfaced in admin "Last synced" widget
  ADD COLUMN IF NOT EXISTS bonzah_last_synced_at TIMESTAMPTZ;

-- Note: bonzah_policy_id VARCHAR(100) already exists from 001_initial_schema.sql

-- Index for the polling job's WHERE clause (active policies, recent trips)
CREATE INDEX IF NOT EXISTS idx_bookings_bonzah_policy_active
  ON bookings (insurance_status, trip_end_date)
  WHERE bonzah_policy_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 2. bonzah_events — audit log of every Bonzah API interaction
-- ────────────────────────────────────────────────────────────
-- Every call to backend/utils/bonzah.js writes one row here. Used for:
--   - Debugging failed binds (request_json + response_json)
--   - Admin Settings page "Recent activity" table
--   - SLA / error-rate dashboards
CREATE TABLE IF NOT EXISTS bonzah_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,           -- 'auth' | 'quote' | 'bind' | 'policy_get' | 'cancel' | 'extend' | 'epayment' | 'health' | 'poll'
  request_json JSONB,                  -- Outbound payload (with secrets redacted)
  response_json JSONB,                 -- Bonzah's full response body
  status_code INTEGER,                 -- HTTP status
  duration_ms INTEGER,                 -- Round-trip time
  error_text TEXT,                     -- Populated when Bonzah returns data.status !== 0 OR HTTP fails
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bonzah_events_booking ON bonzah_events (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonzah_events_recent ON bonzah_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonzah_events_errors ON bonzah_events (created_at DESC) WHERE error_text IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3. settings — generic key/value runtime config
-- ────────────────────────────────────────────────────────────
-- Used for any feature flag or tunable that should be admin-editable
-- without a redeploy. Bonzah is the first consumer; future features
-- (e.g., other integrations, rate caps) can reuse this table.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID                       -- nullable; set by dashboard SettingsPage when an admin edits
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION settings_set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4. Seed Bonzah default settings (kill switch off, sane defaults)
-- ────────────────────────────────────────────────────────────
-- bonzah_enabled: master kill switch. When false, customer wizard hides Bonzah entirely.
INSERT INTO settings (key, value) VALUES ('bonzah_enabled', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- bonzah_markup_percent: percent added to Bonzah's base premium before charging customer.
INSERT INTO settings (key, value) VALUES ('bonzah_markup_percent', '10'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- bonzah_tiers: tier definitions exposed in the customer wizard.
-- CDW is mandatory floor (renter requirement). Standard pre-selected.
-- Complete auto-hides when pickup state ∈ bonzah_pai_excluded_states.
INSERT INTO settings (key, value) VALUES ('bonzah_tiers',
  '[
    {"id": "essential", "label": "Essential",  "coverages": ["cdw"],                             "default": false, "recommended": false},
    {"id": "standard",  "label": "Standard",   "coverages": ["cdw", "rcli", "sli"],              "default": true,  "recommended": true},
    {"id": "complete",  "label": "Complete",   "coverages": ["cdw", "rcli", "sli", "pai"],       "default": false, "recommended": false}
  ]'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- bonzah_pai_excluded_states: states where PAI cannot be sold. Populate from Bonzah support before prod.
INSERT INTO settings (key, value) VALUES ('bonzah_pai_excluded_states', '[]'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- bonzah_excluded_states: states where Bonzah is not offered AT ALL (regulatory).
-- Confirmed by brandon@bonzah.com on 2026-05-01: Michigan, New York, Pennsylvania.
-- These states are absent from the /Bonzah/master US states list — Bonzah cannot bind here.
-- When pickup_state ∈ this list, customer wizard hides the Bonzah path entirely
-- and falls back to the "Use my own insurance" form.
INSERT INTO settings (key, value) VALUES ('bonzah_excluded_states', '["Michigan","New York","Pennsylvania"]'::jsonb)
  ON CONFLICT (key) DO NOTHING;
