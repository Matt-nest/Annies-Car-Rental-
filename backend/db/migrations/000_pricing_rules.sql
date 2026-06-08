-- ============================================================================
-- Migration 000 — pricing_rules (seasonal / date-range price multipliers)
-- ============================================================================
-- Admin-defined multipliers applied at booking time by services/pricingService.js
-- (resolveMultiplier) and managed via routes/pricingRules.js. A rule matches when
-- active = true AND its [start_date, end_date] window overlaps the rental, and
-- (vehicle_ids IS NULL OR the booked vehicle is in vehicle_ids).
--
-- Historically created outside the migration set on Annie's project — captured
-- here so a fresh client DB builds cleanly. Empty by default (no rules = no
-- multiplier). Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  multiplier  NUMERIC(4,2) NOT NULL CHECK (multiplier > 0 AND multiplier <= 10),
  vehicle_ids UUID[],                                -- NULL = applies to all vehicles
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_active_dates
  ON pricing_rules (active, start_date, end_date);

ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
