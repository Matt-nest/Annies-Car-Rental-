-- Annie's Car Rental — Initial Schema
-- Run this in your Supabase SQL editor

-- ============================================================
-- VEHICLES
-- ============================================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_code VARCHAR(20) UNIQUE NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  trim VARCHAR(100),
  color VARCHAR(50),
  license_plate VARCHAR(20),
  vin VARCHAR(17),
  category VARCHAR(50) NOT NULL,                    -- 'sedan','suv','truck','luxury','electric'
  daily_rate DECIMAL(10,2) NOT NULL,
  weekly_rate DECIMAL(10,2),
  monthly_rate DECIMAL(10,2),
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  mileage_limit_per_day INTEGER DEFAULT 250,
  overage_rate_per_mile DECIMAL(5,2) DEFAULT 0.25,
  seats INTEGER DEFAULT 5,
  fuel_type VARCHAR(20) DEFAULT 'gasoline',
  transmission VARCHAR(20) DEFAULT 'automatic',
  features JSONB DEFAULT '[]',
  turo_listing_url TEXT,
  thumbnail_url TEXT,
  photo_urls JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'available',           -- 'available','rented','maintenance','retired'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  date_of_birth DATE,
  driver_license_number VARCHAR(50),
  driver_license_state VARCHAR(2),
  driver_license_expiry DATE,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  emergency_contact_name VARCHAR(200),
  emergency_contact_phone VARCHAR(20),
  ghl_contact_id VARCHAR(100),
  tags JSONB DEFAULT '[]',
  total_rentals INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code VARCHAR(30) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),

  -- Dates and times
  pickup_date DATE NOT NULL,
  return_date DATE NOT NULL,
  pickup_time TIME NOT NULL,
  return_time TIME NOT NULL,
  actual_pickup_at TIMESTAMPTZ,
  actual_return_at TIMESTAMPTZ,

  -- Location
  pickup_location VARCHAR(255) NOT NULL,
  return_location VARCHAR(255),
  delivery_requested BOOLEAN DEFAULT FALSE,
  delivery_address TEXT,

  -- Pricing (snapshot at booking time)
  daily_rate DECIMAL(10,2) NOT NULL,
  rental_days INTEGER NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  deposit_status VARCHAR(20) DEFAULT 'pending',     -- 'pending','collected','refunded','forfeited'

  -- Insurance
  insurance_provider VARCHAR(50),                   -- 'bonzah','own_policy','none'
  insurance_status VARCHAR(20) DEFAULT 'pending',   -- 'pending','verified','expired','none'
  bonzah_policy_id VARCHAR(100),
  insurance_details JSONB,

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
  -- Flow: pending_approval → approved → confirmed → active → returned → completed
  -- Alt:  pending_approval → declined | any → cancelled
  owner_approved_at TIMESTAMPTZ,
  owner_declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  cancellation_reason TEXT,
  cancelled_by VARCHAR(20),                         -- 'customer','owner','system'

  -- Vehicle condition
  pickup_mileage INTEGER,
  return_mileage INTEGER,
  pickup_fuel_level VARCHAR(20),
  return_fuel_level VARCHAR(20),
  pickup_condition_notes TEXT,
  return_condition_notes TEXT,
  pickup_photos JSONB DEFAULT '[]',
  return_photos JSONB DEFAULT '[]',

  -- Meta
  special_requests TEXT,
  internal_notes TEXT,
  source VARCHAR(50) DEFAULT 'website',             -- 'website','turo','phone','walk-in','referral'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevents double-booking (excludes declined/cancelled)
CREATE INDEX idx_bookings_vehicle_dates
  ON bookings (vehicle_id, pickup_date, return_date)
  WHERE status NOT IN ('declined', 'cancelled');

CREATE INDEX idx_bookings_status     ON bookings (status);
CREATE INDEX idx_bookings_customer   ON bookings (customer_id);
CREATE INDEX idx_bookings_pickup_date ON bookings (pickup_date);

-- ============================================================
-- BOOKING STATUS LOG (audit trail)
-- ============================================================
CREATE TABLE booking_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by VARCHAR(50) NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_log_booking ON booking_status_log (booking_id);

-- ============================================================
-- BLOCKED DATES
-- ============================================================
CREATE TABLE blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(255),
  notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocked_vehicle_dates ON blocked_dates (vehicle_id, start_date, end_date);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  payment_type VARCHAR(30) NOT NULL,               -- 'rental','deposit','damage','overage','refund'
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(30),                              -- 'card','cash','zelle','venmo','paypal'
  status VARCHAR(20) DEFAULT 'pending',            -- 'pending','completed','failed','refunded'
  reference_id VARCHAR(100),
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_booking ON payments (booking_id);

-- ============================================================
-- DAMAGE REPORTS
-- ============================================================
CREATE TABLE damage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,                   -- 'minor','moderate','major'
  photo_urls JSONB DEFAULT '[]',
  repair_cost DECIMAL(10,2),
  insurance_claim_filed BOOLEAN DEFAULT FALSE,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  source VARCHAR(30) DEFAULT 'direct',             -- 'direct','turo','google'
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VEHICLE AVAILABILITY VIEW
-- ============================================================
CREATE OR REPLACE VIEW vehicle_availability AS
SELECT
  v.id AS vehicle_id,
  v.vehicle_code,
  v.make,
  v.model,
  v.year,
  v.status AS vehicle_status,
  v.daily_rate,
  b.id AS active_booking_id,
  b.booking_code,
  b.pickup_date,
  b.return_date,
  b.status AS booking_status
FROM vehicles v
LEFT JOIN bookings b ON b.vehicle_id = v.id
  AND b.status NOT IN ('declined', 'cancelled', 'completed')
WHERE v.status != 'retired';

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (enable for dashboard auth)
-- ============================================================
ALTER TABLE vehicles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews         ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — all backend API calls use service role key.
-- Dashboard users need authenticated RLS policies. Add when setting up auth users:
-- CREATE POLICY "Admin full access" ON vehicles FOR ALL USING (auth.role() = 'authenticated');
-- (Repeat for each table)
