-- ============================================================
-- Migration 017: Bouncie Telematics Integration
-- Annie's Car Rental
--
-- Adds the full Bouncie (GPS / OBD-II / trip telemetry) integration:
--   1. bouncie_credentials  — single-row OAuth token store (one Bouncie account per install)
--   2. bouncie_vehicles     — mirror of Bouncie-side vehicles + last-known stats
--   3. bouncie_trips        — trip history from webhooks + /trips polling
--   4. bouncie_events       — audit log of every webhook receipt + REST call
--   5. bouncie_geozones     — admin-managed application geo-zones
--
-- Safe to re-run. No existing data is altered.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. bouncie_credentials — OAuth tokens (single connected account)
-- ────────────────────────────────────────────────────────────
-- Bouncie's OAuth is per-user. For a small fleet we expect ONE Bouncie
-- account holding every dongle, so we keep a single-row credential
-- store (enforced by the unique partial index below). If we ever need
-- multi-tenant we promote `id` from singleton to an FK on tenant.
CREATE TABLE IF NOT EXISTS bouncie_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  bouncie_user_email TEXT,
  scopes TEXT,
  connected_by UUID,                              -- admin_profiles.auth_id who clicked Connect
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce singleton — only one active Bouncie credential row at a time.
-- A NULL `disconnected_at` means active; on disconnect we set it instead of deleting
-- so we keep audit history.
ALTER TABLE bouncie_credentials
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bouncie_credentials_active
  ON bouncie_credentials ((disconnected_at IS NULL))
  WHERE disconnected_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- 2. bouncie_vehicles — mirror of Bouncie-side vehicles
-- ────────────────────────────────────────────────────────────
-- Key by IMEI (the OBD-II dongle's hardware ID) since VIN can be blank
-- briefly when a dongle is first plugged in. annie_vehicle_id is the FK
-- to our internal fleet; populated automatically by VIN match, manually
-- via the admin "Map" UI if VIN is missing/mismatched.
CREATE TABLE IF NOT EXISTS bouncie_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imei TEXT NOT NULL UNIQUE,
  vin TEXT,
  annie_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,

  -- Static metadata from Bouncie
  bouncie_year INTEGER,
  bouncie_make TEXT,
  bouncie_model TEXT,
  bouncie_nickname TEXT,

  -- Last-known live stats (updated by REST poll + tripData webhooks)
  last_lat NUMERIC(10, 7),
  last_lng NUMERIC(10, 7),
  last_heading NUMERIC(5, 2),
  last_speed_mph NUMERIC(6, 2),
  last_address TEXT,
  last_fuel_pct NUMERIC(5, 2),
  last_odometer_miles NUMERIC(10, 2),
  last_engine_running BOOLEAN,
  last_battery_status TEXT,                       -- 'normal' | 'low' | 'critical'
  last_mil_status TEXT,                           -- 'ON' or NULL
  last_dtc_codes TEXT,                            -- comma-sep e.g. "P0420,P0171"

  last_synced_at TIMESTAMPTZ,
  raw_json JSONB,                                 -- full last-seen vehicle payload from Bouncie

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bouncie_vehicles_vin ON bouncie_vehicles (vin) WHERE vin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bouncie_vehicles_annie ON bouncie_vehicles (annie_vehicle_id) WHERE annie_vehicle_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3. bouncie_trips — trip history
-- ────────────────────────────────────────────────────────────
-- One row per Bouncie trip. We capture both ends (start + metrics) and
-- store the gps polyline for replay/analysis. annie_booking_id is set
-- by a join job that finds the booking active during the trip window.
CREATE TABLE IF NOT EXISTS bouncie_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bouncie_transaction_id TEXT NOT NULL UNIQUE,
  imei TEXT NOT NULL,
  annie_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  annie_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,

  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  distance_miles NUMERIC(10, 2),
  avg_speed_mph NUMERIC(6, 2),
  max_speed_mph NUMERIC(6, 2),
  fuel_consumed_gallons NUMERIC(8, 3),
  hard_brake_count INTEGER DEFAULT 0,
  hard_accel_count INTEGER DEFAULT 0,

  start_lat NUMERIC(10, 7),
  start_lng NUMERIC(10, 7),
  end_lat NUMERIC(10, 7),
  end_lng NUMERIC(10, 7),
  start_address TEXT,
  end_address TEXT,

  -- Polyline (encoded Google polyline) or GeoJSON LineString — set by /trips REST poll
  gps_polyline TEXT,
  gps_geojson JSONB,

  raw_json JSONB,                                 -- full tripMetrics payload
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bouncie_trips_vehicle_start ON bouncie_trips (annie_vehicle_id, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_bouncie_trips_booking ON bouncie_trips (annie_booking_id) WHERE annie_booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bouncie_trips_imei_start ON bouncie_trips (imei, start_at DESC);

-- ────────────────────────────────────────────────────────────
-- 4. bouncie_events — audit log of every webhook receipt + REST call
-- ────────────────────────────────────────────────────────────
-- Used for:
--   - Debugging missing/duplicate events (Bouncie warns about tripData duplication on reconnect)
--   - Settings page "Recent activity" feed
--   - Rate / error dashboards
CREATE TABLE IF NOT EXISTS bouncie_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,                       -- 'connect' | 'disconnect' | 'mil' | 'battery' | 'tripStart' | 'tripData' | 'tripMetrics' | 'tripEnd' | 'vinChange' | 'applicationGeozone' | 'userGeozone' | 'rest_call'
  source TEXT NOT NULL,                           -- 'webhook' | 'rest' | 'poll'
  imei TEXT,
  vin TEXT,
  annie_vehicle_id UUID,
  annie_booking_id UUID,

  payload JSONB,                                  -- inbound webhook body OR outbound REST response
  request_path TEXT,                              -- REST endpoint hit (for source='rest')
  status_code INTEGER,                            -- HTTP status (for source='rest')
  duration_ms INTEGER,
  error_text TEXT,

  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bouncie_events_recent ON bouncie_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_bouncie_events_type ON bouncie_events (event_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_bouncie_events_imei ON bouncie_events (imei, received_at DESC) WHERE imei IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bouncie_events_errors ON bouncie_events (received_at DESC) WHERE error_text IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 5. bouncie_geozones — admin-managed Application Geo-Zones
-- ────────────────────────────────────────────────────────────
-- Bouncie's geozone model has 3 entities: Location → (optional) Schedule → Geozone.
-- We collapse that into one local row for the admin UI; on save we POST all 3 in sequence.
CREATE TABLE IF NOT EXISTS bouncie_geozones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bouncie_location_id TEXT,
  bouncie_schedule_id TEXT,
  bouncie_geozone_id TEXT,

  geometry_type TEXT NOT NULL,                    -- 'circle' | 'polygon'
  center_lat NUMERIC(10, 7),
  center_lng NUMERIC(10, 7),
  radius_meters NUMERIC(10, 2),
  polygon_geojson JSONB,                          -- For polygon geometry

  enabled BOOLEAN NOT NULL DEFAULT true,
  alert_on_enter BOOLEAN NOT NULL DEFAULT false,
  alert_on_exit BOOLEAN NOT NULL DEFAULT true,    -- Default: alert when a rental leaves the zone

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bouncie_geozones_enabled ON bouncie_geozones (enabled) WHERE enabled = true;

-- ────────────────────────────────────────────────────────────
-- 6. bookings — extra columns for telematics-driven mileage
-- ────────────────────────────────────────────────────────────
-- When the customer submits checkout via the portal, we also snapshot
-- Bouncie's current odometer for that vehicle so admin can compare
-- manual vs. telematics reading and catch discrepancies.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS bouncie_pickup_odometer NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS bouncie_return_odometer NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS bouncie_pickup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bouncie_return_at TIMESTAMPTZ;
