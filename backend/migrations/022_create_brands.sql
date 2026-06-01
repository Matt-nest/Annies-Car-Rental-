-- ════════════════════════════════════════════════════════════════════════
-- Migration: Create brands table for white-label management
-- Run this in your Supabase SQL Editor (Dashboard → SQL → New Query)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS brands (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  legal_entity    TEXT,
  dba             TEXT,
  domain          TEXT,

  -- Contact
  phone           TEXT,
  email           TEXT,
  owner_email     TEXT,

  -- Location
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  address         TEXT,
  timezone        TEXT DEFAULT 'America/New_York',

  -- Visual
  color_accent       TEXT DEFAULT '#D4AF37',
  color_accent_dark  TEXT DEFAULT '#B8941E',
  logo_url           TEXT,

  -- SEO
  meta_description   TEXT,

  -- Integrations
  stripe_prefix      TEXT,
  review_link        TEXT,
  chat_widget_id     TEXT,

  -- Financial
  tax_rate           NUMERIC(5,4) DEFAULT 0.07,
  deposit_cents      INTEGER DEFAULT 15000,

  -- Meta
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_brands_updated_at();

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands (slug);
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands (is_active);

-- RLS: allow service-role full access (backend uses service key)
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON brands FOR ALL
  USING (true)
  WITH CHECK (true);
