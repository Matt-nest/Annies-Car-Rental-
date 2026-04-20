-- Migration 003: Add photo_slots JSONB column to checkin_records
-- Purpose: Support structured slot-name → URL mapping for customer check-in photos
-- (front, driver_side, passenger_side, rear, dashboard, damage)
--
-- Backward compatible: existing records will have photo_slots = NULL.
-- The existing photo_urls TEXT[] column continues to be populated for backward compat.

ALTER TABLE checkin_records
  ADD COLUMN IF NOT EXISTS photo_slots JSONB DEFAULT NULL;

-- Verification:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'checkin_records' AND column_name = 'photo_slots';
