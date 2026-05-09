-- ============================================================================
-- Migration 013 — SMS opt-out tracking (TCPA compliance)
-- ============================================================================
-- Purpose: track customers who replied STOP/UNSUB so the app can short-circuit
-- outbound SMS instead of relying solely on Twilio's carrier-level block.
-- Phase 1 audit F-21.
--
-- Twilio's carrier honors STOP automatically (subsequent messages from your
-- `From` to that customer fail with error 21610), but the app stored no
-- consent state. TCPA compliance for unsolicited marketing
-- (`repeat_customer`, `extension_offer`) requires explicit consent tracking.
-- A future second `From` number, or a future provider migration, would also
-- bypass Twilio's per-number block — making app-level state the safe layer.
--
-- Apply via: paste into Supabase SQL Editor, run, verify with the queries
-- at the bottom.
-- ============================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_opt_out_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_sms_opt_out
  ON customers (sms_opt_out)
  WHERE sms_opt_out = TRUE;

-- ── Verification queries ────────────────────────────────────────────────────
--
-- 1. Confirm columns added:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_name = 'customers' AND column_name LIKE 'sms_opt_out%';
--
-- 2. All existing customers default to opted-in (no historical consent
--    revocation to backfill — Twilio carrier-level STOPs were never
--    surfaced into the app, so we have no signal to seed from):
--    SELECT COUNT(*) FROM customers WHERE sms_opt_out = TRUE;  -- expect 0
