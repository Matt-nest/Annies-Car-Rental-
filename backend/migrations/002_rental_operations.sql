-- ============================================================
-- Annie's Car Rental — Rental Operations Schema
-- Migration 002: Check-in/check-out, deposits, add-ons,
--   incidentals, invoices, disputes, tolls, portal
-- ============================================================
-- Run this in your Supabase SQL editor.
-- ⚠️ REVIEW BEFORE RUNNING — this adds tables and columns
--    to the production database.
-- ============================================================


-- ============================================================
-- 1. VEHICLE DEPOSITS (per-vehicle deposit configuration)
-- ============================================================
CREATE TABLE vehicle_deposits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,           -- in cents (15000 = $150)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehicle_id)
);

CREATE TRIGGER vehicle_deposits_updated_at
  BEFORE UPDATE ON vehicle_deposits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE vehicle_deposits ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. BOOKING ADD-ONS (selected during booking)
-- ============================================================
CREATE TABLE booking_addons (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  addon_type   VARCHAR(30) NOT NULL,       -- 'unlimited_miles', 'unlimited_tolls', 'delivery'
  amount       INTEGER NOT NULL,           -- in cents (10000 = $100)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_addons_booking ON booking_addons (booking_id);

ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 3. BOOKING DEPOSITS (deposit lifecycle tracking)
--    Separate from the rental payment — has its own Stripe charge
-- ============================================================
CREATE TABLE booking_deposits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL,             -- in cents
  status            VARCHAR(30) NOT NULL DEFAULT 'pending',
                    -- 'pending', 'held', 'partially_refunded', 'refunded', 'applied'
  stripe_charge_id  TEXT,                         -- Stripe PaymentIntent or charge ID
  refund_amount     INTEGER,                      -- cents refunded (nullable)
  applied_amount    INTEGER,                      -- cents applied to incidentals (nullable)
  refunded_at       TIMESTAMPTZ,
  refunded_by       TEXT,                         -- admin email or 'system'
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id)
);

CREATE TRIGGER booking_deposits_updated_at
  BEFORE UPDATE ON booking_deposits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE booking_deposits ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. INCIDENTALS (post-return charges)
-- ============================================================
CREATE TABLE incidentals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type         VARCHAR(30) NOT NULL,
               -- 'cleaning', 'gas', 'smoking', 'damage', 'late_return',
               -- 'mileage_overage', 'toll_violation', 'other'
  amount       INTEGER NOT NULL,           -- in cents
  description  TEXT,
  photo_urls   TEXT[] DEFAULT '{}',
  waived       BOOLEAN DEFAULT FALSE,      -- admin can waive fee ($0)
  created_by   TEXT NOT NULL,              -- admin email
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_incidentals_booking ON incidentals (booking_id);

CREATE TRIGGER incidentals_updated_at
  BEFORE UPDATE ON incidentals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE incidentals ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 5. INVOICES (generated after inspection)
-- ============================================================
CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  items             JSONB NOT NULL DEFAULT '[]',  -- [{type, description, amount}]
  subtotal          INTEGER NOT NULL,              -- cents
  deposit_applied   INTEGER NOT NULL DEFAULT 0,    -- cents (negative = applied)
  amount_due        INTEGER NOT NULL DEFAULT 0,    -- cents (>0 = customer owes, <0 = refund)
  status            VARCHAR(20) NOT NULL DEFAULT 'draft',
                    -- 'draft', 'sent', 'paid', 'disputed'
  sent_at           TIMESTAMPTZ,
  stripe_payment_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id)
);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. CUSTOMER DISPUTES (against invoices)
-- ============================================================
CREATE TABLE customer_disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  photo_urls      TEXT[] DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
                  -- 'open', 'resolved', 'rejected'
  admin_response  TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disputes_booking ON customer_disputes (booking_id);
CREATE INDEX idx_disputes_status  ON customer_disputes (status);

CREATE TRIGGER customer_disputes_updated_at
  BEFORE UPDATE ON customer_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE customer_disputes ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 7. TOLL CHARGES (per-vehicle toll logging)
-- ============================================================
CREATE TABLE toll_charges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  booking_id   UUID REFERENCES bookings(id) ON DELETE SET NULL,  -- nullable, may not be linked
  amount       INTEGER NOT NULL,           -- cents
  toll_date    DATE NOT NULL,
  description  TEXT,
  logged_by    TEXT NOT NULL,              -- admin email
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tolls_vehicle ON toll_charges (vehicle_id);
CREATE INDEX idx_tolls_booking ON toll_charges (booking_id);

CREATE TRIGGER toll_charges_updated_at
  BEFORE UPDATE ON toll_charges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE toll_charges ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 8. CHECK-IN RECORDS (admin prep + customer self-service)
-- ============================================================
CREATE TABLE checkin_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  record_type     VARCHAR(30) NOT NULL,
                  -- 'admin_prep', 'customer_checkin', 'customer_checkout', 'admin_inspection'
  odometer        INTEGER,
  fuel_level      VARCHAR(20),            -- 'full', 'three_quarter', 'half', 'quarter', 'empty'
  condition_notes TEXT,
  photo_urls      TEXT[] DEFAULT '{}',
  created_by      TEXT NOT NULL,          -- 'admin' or 'customer' or admin email
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checkin_booking ON checkin_records (booking_id);

ALTER TABLE checkin_records ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 9. COLUMN ADDITIONS — vehicles table
-- ============================================================
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS lockbox_code TEXT;


-- ============================================================
-- 10. COLUMN ADDITIONS — bookings table
-- ============================================================
-- Add-on flags
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS has_unlimited_miles BOOLEAN DEFAULT FALSE;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS has_unlimited_tolls BOOLEAN DEFAULT FALSE;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS has_delivery BOOLEAN DEFAULT FALSE;

-- Odometer tracking (admin/customer check-in records are authoritative,
-- but these provide quick access on the booking row)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS checkin_odometer INTEGER;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS checkout_odometer INTEGER;

-- Inspection tracking
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS inspection_completed_at TIMESTAMPTZ;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS inspection_completed_by TEXT;

-- Note: actual_return_at, deposit_amount, and deposit_status
-- already exist on the bookings table from the initial schema.
-- We keep them as-is for backward compatibility.
-- The booking_deposits table is now the authoritative source
-- for deposit lifecycle tracking.


-- ============================================================
-- 11. SEED DATA — vehicle_deposits
--     Maps each vehicle to its deposit amount.
--     Murano = $200, Expedition = $250, all others = $150.
-- ============================================================
INSERT INTO vehicle_deposits (vehicle_id, amount)
SELECT
  v.id,
  CASE
    WHEN LOWER(v.model) LIKE '%murano%' THEN 20000
    WHEN LOWER(v.model) LIKE '%expedition%' THEN 25000
    ELSE 15000
  END
FROM vehicles v
WHERE v.status != 'retired'
ON CONFLICT (vehicle_id) DO NOTHING;


-- ============================================================
-- VERIFICATION QUERIES (run after migration to confirm)
-- ============================================================
-- SELECT COUNT(*) FROM vehicle_deposits;
-- SELECT vd.amount/100 as deposit_dollars, v.year, v.make, v.model
--   FROM vehicle_deposits vd JOIN vehicles v ON v.id = vd.vehicle_id
--   ORDER BY vd.amount DESC;
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'bookings' AND column_name IN
--   ('has_unlimited_miles','has_unlimited_tolls','has_delivery',
--    'checkin_odometer','checkout_odometer',
--    'inspection_completed_at','inspection_completed_by');
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'vehicles' AND column_name = 'lockbox_code';
