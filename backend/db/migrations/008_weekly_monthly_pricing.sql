-- ============================================================
-- Migration 008: Weekly Pricing Engine + Monthly Lead-Gen
-- Phase 1 — Annie's Car Rental
-- All statements use ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS
-- Safe to re-run. Historical booking data is NOT altered.
-- ============================================================

-- 1. Add weekly pricing columns to vehicles
-- weekly_discount_percent: per-vehicle discount (5–25%). Drives computed weekly rate.
-- weekly_unlimited_mileage_enabled: whether 7+ day rentals include unlimited mileage.
-- monthly_display_price: marketing price in whole dollars. NULL = not available monthly.
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS weekly_discount_percent INTEGER NOT NULL DEFAULT 15
    CONSTRAINT vehicles_weekly_discount_range CHECK (weekly_discount_percent BETWEEN 5 AND 25),
  ADD COLUMN IF NOT EXISTS weekly_unlimited_mileage_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS monthly_display_price INTEGER;

-- 2. Re-derive vehicles.weekly_rate to match new formula at default 15% discount.
-- Old values were manually set (inconsistent ~19–22% range). New formula:
--   weekly_rate = ROUND((daily_rate * 7) * (1 - weekly_discount_percent / 100.0), 2)
-- This intentionally changes all 26 vehicles' stored weekly rates.
UPDATE vehicles
  SET weekly_rate = ROUND((daily_rate * 7) * (1 - weekly_discount_percent / 100.0), 2);

-- 3. Add booking rate context columns.
-- rate_type: 'daily' | 'weekly' | 'weekly_mixed' — set at booking creation.
-- weekly_discount_applied: the discount % at booking time (self-describing historical record).
-- mileage_allowance: 'unlimited' or a numeric string like '1050' (total trip miles).
--   VARCHAR not INTEGER: 'unlimited' is a legitimate value that can't be stored as a number.
-- line_items: full pricing breakdown stored at booking creation as JSONB.
--   Never recomputed — this is the financial record of what was actually charged.
--   Shape: [{ "label": "1 week", "amount": 583.10 }, { "label": "Tax (7%)", "amount": 40.82 }]
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rate_type VARCHAR(20) NOT NULL DEFAULT 'daily'
    CONSTRAINT bookings_rate_type_values
      CHECK (rate_type IN ('daily', 'weekly', 'weekly_mixed')),
  ADD COLUMN IF NOT EXISTS weekly_discount_applied INTEGER,
  ADD COLUMN IF NOT EXISTS mileage_allowance VARCHAR(20),
  ADD COLUMN IF NOT EXISTS line_items JSONB;

-- 4. Backfill all existing bookings to rate_type = 'daily'.
-- weekly_discount_applied, mileage_allowance, line_items intentionally left NULL
-- for existing bookings — we do not retroactively compute historical data.
UPDATE bookings
  SET rate_type = 'daily'
  WHERE rate_type IS NULL OR rate_type = '';

-- 5. Create monthly_inquiries table.
CREATE TABLE IF NOT EXISTS monthly_inquiries (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID         REFERENCES vehicles(id),
  name            TEXT         NOT NULL,
  phone           TEXT         NOT NULL,
  email           TEXT         NOT NULL,
  pickup_date     DATE,
  return_date     DATE,
  message         TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'new'
    CONSTRAINT monthly_inquiries_status_values
      CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  contacted_at    TIMESTAMPTZ,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS monthly_inquiries_status_idx
  ON monthly_inquiries(status);
CREATE INDEX IF NOT EXISTS monthly_inquiries_created_at_idx
  ON monthly_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS monthly_inquiries_vehicle_id_idx
  ON monthly_inquiries(vehicle_id);
