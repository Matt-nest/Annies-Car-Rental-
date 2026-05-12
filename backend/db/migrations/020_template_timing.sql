-- ============================================================================
-- Migration 020 — Notification template timing externalization (Phase 2)
-- ============================================================================
-- Purpose: surface the timing config currently hardcoded in routes/cron.js
-- onto each email_templates row so the timeline UI can display and (eventually)
-- edit it. The cron rewrite that reads these columns is shipped separately
-- behind FEATURE_TIMELINE_TIMING — until that flag flips on, edits to these
-- columns are display-only and do NOT change reminder behavior.
--
-- Schema additions:
--   - lifecycle_position    Where the card lives on the timeline (0–7)
--   - visual_order          Secondary sort within a position
--   - trigger_kind          'event' (fires on booking transition) or 'cron'
--   - trigger_anchor        Which booking date the offset is measured from
--   - trigger_offset_minutes Signed; negative = before anchor, positive = after
--   - trigger_status_filter Booking statuses that qualify (cron-stages only)
--
-- Lifecycle position legend:
--   0 = request    (booking submitted)
--   1 = approval   (approve / decline / cancel + insurance bind)
--   2 = payment    (payment confirmed)
--   3 = ready      (vehicle prepped for pickup)
--   4 = pickup     (24h reminder, day-of)
--   5 = during     (mid-rental check-in, extension offer)
--   6 = return     (24h reminder, day-of, late warnings, return confirmed)
--   7 = post-trip  (review request, invoice, deposit settlement, loyalty)
--
-- Backfill values mirror the hardcoded queries in routes/cron.js exactly:
--   tomorrow()       = offset_minutes = -1440  (anchor is 1 day in future)
--   today()          = offset_minutes = 0
--   daysAgo(2)       = offset_minutes = +2880  (anchor is 2 days in past)
--   daysAgo(30)      = offset_minutes = +43200
-- See routes/cron.js daily + morning handlers for the source of truth.
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS lifecycle_position     INTEGER,
  ADD COLUMN IF NOT EXISTS visual_order           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trigger_kind           TEXT,
  ADD COLUMN IF NOT EXISTS trigger_anchor         TEXT,
  ADD COLUMN IF NOT EXISTS trigger_offset_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS trigger_status_filter  TEXT[];

-- Trigger-kind check (NULL allowed for unknown / custom templates)
DO $$ BEGIN
  ALTER TABLE email_templates
    ADD CONSTRAINT email_templates_trigger_kind_chk
    CHECK (trigger_kind IS NULL OR trigger_kind IN ('event','cron'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lifecycle-position range (NULL allowed)
DO $$ BEGIN
  ALTER TABLE email_templates
    ADD CONSTRAINT email_templates_lifecycle_pos_chk
    CHECK (lifecycle_position IS NULL OR (lifecycle_position BETWEEN 0 AND 7));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sanity bound on offset (-7 days to +30 days) — matches routes/cron.js safety check
DO $$ BEGIN
  ALTER TABLE email_templates
    ADD CONSTRAINT email_templates_offset_range_chk
    CHECK (trigger_offset_minutes IS NULL OR (trigger_offset_minutes BETWEEN -10080 AND 43200));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Backfill — sets timing config for every stage we ship with.
-- Idempotent: re-running updates the same rows. The WHERE clause restricts
-- updates to the canonical stages; custom user-created stages keep NULL.
-- ────────────────────────────────────────────────────────────────────────────
UPDATE email_templates SET
  lifecycle_position = CASE stage
    WHEN 'booking_submitted'           THEN 0
    WHEN 'booking_approved'            THEN 1
    WHEN 'booking_declined'            THEN 1
    WHEN 'booking_cancelled'           THEN 1
    WHEN 'insurance_policy_issued'     THEN 1
    WHEN 'insurance_bind_failed'       THEN 1
    WHEN 'payment_confirmed'           THEN 2
    WHEN 'ready_for_pickup'            THEN 3
    WHEN 'pickup_reminder'             THEN 4
    WHEN 'day_of_pickup'               THEN 4
    WHEN 'mid_rental_checkin'          THEN 5
    WHEN 'extension_offer'             THEN 5
    WHEN 'return_reminder'             THEN 6
    WHEN 'day_of_return'               THEN 6
    WHEN 'return_confirmed'            THEN 6
    WHEN 'late_return_warning'         THEN 6
    WHEN 'late_return_escalation'      THEN 6
    WHEN 'rental_completed'            THEN 7
    WHEN 'repeat_customer'             THEN 7
    WHEN 'deposit_refunded'            THEN 7
    WHEN 'deposit_settled'             THEN 7
    WHEN 'invoice_sent'                THEN 7
    WHEN 'damage_notification'         THEN 7
    WHEN 'inspection_charges_scheduled' THEN 7
    ELSE lifecycle_position
  END,
  trigger_kind = CASE stage
    WHEN 'pickup_reminder'        THEN 'cron'
    WHEN 'day_of_pickup'          THEN 'cron'
    WHEN 'mid_rental_checkin'     THEN 'cron'
    WHEN 'extension_offer'        THEN 'cron'
    WHEN 'return_reminder'        THEN 'cron'
    WHEN 'day_of_return'          THEN 'cron'
    WHEN 'late_return_warning'    THEN 'cron'
    WHEN 'late_return_escalation' THEN 'cron'
    WHEN 'rental_completed'       THEN 'cron'
    WHEN 'repeat_customer'        THEN 'cron'
    -- Everything else fires on a status transition event (sendBookingNotification
    -- called from transitionBooking, createBooking, payment webhooks, etc.)
    ELSE 'event'
  END,
  trigger_anchor = CASE stage
    WHEN 'pickup_reminder'        THEN 'pickup_date'
    WHEN 'day_of_pickup'          THEN 'pickup_date'
    WHEN 'mid_rental_checkin'     THEN 'pickup_date'
    WHEN 'extension_offer'        THEN 'return_date'
    WHEN 'return_reminder'        THEN 'return_date'
    WHEN 'day_of_return'          THEN 'return_date'
    WHEN 'late_return_warning'    THEN 'return_date'
    WHEN 'late_return_escalation' THEN 'return_date'
    WHEN 'rental_completed'       THEN 'return_date'
    WHEN 'repeat_customer'        THEN 'return_date'
    ELSE NULL
  END,
  trigger_offset_minutes = CASE stage
    WHEN 'pickup_reminder'        THEN -1440   -- 24h before pickup
    WHEN 'day_of_pickup'          THEN 0       -- morning of pickup
    WHEN 'mid_rental_checkin'     THEN 2880    -- 48h after pickup (day 3)
    WHEN 'extension_offer'        THEN -1440   -- 24h before return
    WHEN 'return_reminder'        THEN -1440   -- 24h before return
    WHEN 'day_of_return'          THEN 0       -- morning of return
    WHEN 'late_return_warning'    THEN 1440    -- first trigger 24h overdue (ongoing daily after)
    WHEN 'late_return_escalation' THEN 5760    -- 4 days after return date
    WHEN 'rental_completed'       THEN 1440    -- day after return → review request
    WHEN 'repeat_customer'        THEN 43200   -- 30 days after return → loyalty
    ELSE NULL
  END,
  trigger_status_filter = CASE stage
    WHEN 'pickup_reminder'        THEN ARRAY['approved','confirmed','ready_for_pickup']
    WHEN 'day_of_pickup'          THEN ARRAY['approved','confirmed','ready_for_pickup']
    WHEN 'mid_rental_checkin'     THEN ARRAY['active']
    WHEN 'extension_offer'        THEN ARRAY['active']
    WHEN 'return_reminder'        THEN ARRAY['active']
    WHEN 'day_of_return'          THEN ARRAY['active']
    WHEN 'late_return_warning'    THEN ARRAY['active']
    WHEN 'late_return_escalation' THEN ARRAY['active']
    WHEN 'rental_completed'       THEN ARRAY['completed']
    WHEN 'repeat_customer'        THEN ARRAY['completed']
    ELSE NULL
  END
WHERE stage IN (
  'booking_submitted','booking_approved','booking_declined','booking_cancelled',
  'payment_confirmed','ready_for_pickup','pickup_reminder','day_of_pickup',
  'mid_rental_checkin','extension_offer','return_reminder','day_of_return',
  'return_confirmed','late_return_warning','late_return_escalation',
  'rental_completed','repeat_customer','deposit_refunded','deposit_settled',
  'invoice_sent','damage_notification','inspection_charges_scheduled',
  'insurance_policy_issued','insurance_bind_failed'
);

-- ────────────────────────────────────────────────────────────────────────────
-- Verification queries
-- ────────────────────────────────────────────────────────────────────────────
--
-- 1. All canonical stages have a position + kind set:
--    SELECT stage, lifecycle_position, trigger_kind, trigger_anchor, trigger_offset_minutes
--    FROM email_templates
--    WHERE stage IN ('pickup_reminder','day_of_pickup','rental_completed')
--    ORDER BY lifecycle_position;
--
-- 2. Cron-triggered stages all have anchor + offset + filter:
--    SELECT stage, trigger_anchor, trigger_offset_minutes, trigger_status_filter
--    FROM email_templates
--    WHERE trigger_kind = 'cron'
--    ORDER BY lifecycle_position;
--
-- 3. Event-triggered stages have anchor + offset NULL (expected):
--    SELECT stage, trigger_anchor, trigger_offset_minutes
--    FROM email_templates
--    WHERE trigger_kind = 'event'
--    ORDER BY lifecycle_position;
--
-- 4. Out-of-range guard (should return 0 rows):
--    SELECT stage, trigger_offset_minutes FROM email_templates
--    WHERE trigger_offset_minutes < -10080 OR trigger_offset_minutes > 43200;
