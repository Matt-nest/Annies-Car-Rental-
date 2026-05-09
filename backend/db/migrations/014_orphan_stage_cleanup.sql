-- ============================================================================
-- Migration 014 — orphan stage cleanup
-- ============================================================================
-- Purpose: drop seeded email_templates rows for stages that the Phase 1 audit
-- (F-4) decided to retire. They were exposed in the dashboard picker UI but
-- had no caller anywhere in code — clicking them did nothing the admin
-- expected.
--
-- Decisions logged in MESSAGING_PHASE1_HANDOFF.md §3 F-4/F-5:
--   - delivery_offer       → DELETE (overlaps booking_submitted's delivery copy)
--   - refund_processed     → DELETE (deposit_refunded already covers this)
--   - inspection_complete  → DELETE (deposit_settled / deposit_refunded carry
--                                    the message — user opted to skip)
--
-- The other orphan stages (damage_notification, day_of_pickup, day_of_return,
-- insurance_policy_issued, insurance_bind_failed, invoice_sent) are kept —
-- the first three are now wired in code, the Bonzah pair is intentionally
-- unwired pending separate decision, and invoice_sent stays as a manual-only
-- template.
--
-- Apply via: paste into Supabase SQL Editor, run, verify with the queries
-- at the bottom.
-- ============================================================================

DELETE FROM email_templates
WHERE stage IN ('delivery_offer', 'refund_processed', 'inspection_complete');

-- ── Verification queries ────────────────────────────────────────────────────
--
-- 1. Confirm the rows are gone (expect 0):
--    SELECT COUNT(*) FROM email_templates
--    WHERE stage IN ('delivery_offer', 'refund_processed', 'inspection_complete');
--
-- 2. Spot-check the remaining stages:
--    SELECT stage, name, is_active FROM email_templates ORDER BY stage;
