-- ============================================================================
-- Migration 019 — Trusted customer auto-approve
-- ============================================================================
-- Purpose: let admins flag known-good customers so their bookings skip the
-- pending_approval queue and go directly to `approved`. Customers still go
-- through the insurance + payment + agreement wizard — we are short-circuiting
-- the *manual admin approval* step only, NOT the legal/payment steps.
--
-- This migration is the foundation for:
--   - bookingService.createBooking() — checks is_trusted after insert and
--     transitions to 'approved' immediately if true (firing the same
--     booking_approved notification as a manual approval)
--   - PATCH /api/v1/customers/:id/trust — admin sets/clears the flag
--   - CustomerDetailPage → Trusted toggle
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_trusted  BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trusted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trusted_by  UUID,                 -- staff user_id
  ADD COLUMN IF NOT EXISTS trusted_note TEXT;                -- e.g. "Repeat customer, 5 successful rentals"

-- Partial index — admin "Trusted Customers" listings filter on is_trusted=TRUE
CREATE INDEX IF NOT EXISTS idx_customers_is_trusted
  ON customers (is_trusted)
  WHERE is_trusted = TRUE;

-- ────────────────────────────────────────────────────────────────────────────
-- Verification queries
-- ────────────────────────────────────────────────────────────────────────────
--
-- 1. Confirm columns added:
--    SELECT column_name, data_type, is_nullable, column_default
--    FROM information_schema.columns
--    WHERE table_name = 'customers' AND column_name LIKE 'trusted%' OR column_name = 'is_trusted';
--
-- 2. All existing customers default to untrusted:
--    SELECT COUNT(*) FROM customers WHERE is_trusted = TRUE;  -- expect 0
--
-- 3. Index exists:
--    SELECT indexname FROM pg_indexes
--    WHERE tablename = 'customers' AND indexname = 'idx_customers_is_trusted';
