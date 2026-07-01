-- 025_schema_drift_fixes.sql
-- Additive columns the application code already reads AND writes, but which are
-- missing from the live schema (drift). Both are idempotent and non-destructive.
--
-- Discovered 2026-06-30 by validating every backend .select() against the live
-- schema. Symptom: 500 "column X does not exist" on the affected endpoints.

-- ── invoices.invoice_number ───────────────────────────────────────────────
-- Used by GET /api/v1/bookings/:id/invoice/pdf to persist a stable invoice
-- number across regenerations (select / update / insert in routes/invoices.js).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- ── pending_overage_charges.attempts ──────────────────────────────────────
-- Drives the auto-overage retry logic (4-attempt cap + backoff) in
-- services/cardOnFileService.js (select / update). Default 0 = no attempts yet.
ALTER TABLE pending_overage_charges
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

-- Force PostgREST to pick up the new columns immediately (clears PGRST204/205).
NOTIFY pgrst, 'reload schema';
