-- ============================================================================
-- Migration 022 — Unify customer-facing phone number across all email templates
-- ============================================================================
-- Purpose: replace the legacy contact patterns in email_templates with the
-- new unified business number +17722071655 (configured as the Twilio hunt
-- group target). Three problems being fixed:
--
--   1. (772) 985-6667 was Aaron's personal cell number embedded in template
--      bodies. Customers calling that number reached only Aaron.
--   2. Multi-line "Matthew: ... / Robin: ... / Aaron: ..." blocks listed
--      staff personal cells publicly — privacy concern AND confusing UX.
--   3. (772) 834-0117 + (772) 834-7637 were Matthew's and Robin's cells
--      sprinkled inline.
--
-- After migration, all customer-facing contact mentions point to
-- (772) 207-1655 / +17722071655, which Twilio routes through the hunt
-- group (Aaron → Robin → Dylan → voicemail).
--
-- Safe to re-run (REPLACE is idempotent; regex patterns won't match
-- already-replaced content).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Step 1: Collapse 3-line "Matthew / Robin / Aaron" staff-cell blocks
-- ────────────────────────────────────────────────────────────────────────────
UPDATE email_templates SET body = regexp_replace(body,
  E'\\s*Matthew:\\s+\\(772\\)\\s*834-0117\\s*\\n\\s*Robin:\\s+\\(772\\)\\s*834-7637\\s*\\n\\s*Aaron:\\s+\\(772\\)\\s*985-6667',
  E'\n  Call or text us at (772) 207-1655',
  'g'
) WHERE body LIKE '%Matthew%' AND body LIKE '%Aaron%' AND body LIKE '%985-6667%';

-- ────────────────────────────────────────────────────────────────────────────
-- Step 2: Collapse 2-line "Matthew / Robin" blocks (no Aaron)
-- ────────────────────────────────────────────────────────────────────────────
UPDATE email_templates SET body = regexp_replace(body,
  E'\\s*Matthew:\\s+\\(772\\)\\s*834-0117\\s*\\n\\s*Robin:\\s+\\(772\\)\\s*834-7637',
  E'\n  Call or text us at (772) 207-1655',
  'g'
) WHERE body LIKE '%Matthew%' AND body LIKE '%Robin%' AND body LIKE '%834-0117%';

-- ────────────────────────────────────────────────────────────────────────────
-- Step 3: Collapse 2-line "Matthew / Aaron" blocks (skipping Robin)
-- ────────────────────────────────────────────────────────────────────────────
UPDATE email_templates SET body = regexp_replace(body,
  E'\\s*Matthew:\\s+\\(772\\)\\s*834-0117\\s*\\n\\s*Aaron:\\s+\\(772\\)\\s*985-6667',
  E'\n  Call or text us at (772) 207-1655',
  'g'
) WHERE body LIKE '%Matthew%' AND body LIKE '%Aaron%' AND body LIKE '%834-0117%';

-- ────────────────────────────────────────────────────────────────────────────
-- Step 4: Any remaining standalone "Name: (772) cell" lines
-- ────────────────────────────────────────────────────────────────────────────
UPDATE email_templates SET body = regexp_replace(body,
  E'\\s*(Matthew|Robin|Aaron):\\s+\\(772\\)\\s*(834-0117|834-7637|985-6667)',
  E'\n  (772) 207-1655',
  'g'
) WHERE body ~ '(Matthew|Robin|Aaron):';

-- ────────────────────────────────────────────────────────────────────────────
-- Step 5: Final pass — bare number replacements anywhere they appear
-- ────────────────────────────────────────────────────────────────────────────
UPDATE email_templates SET
  body = REPLACE(REPLACE(REPLACE(REPLACE(body,
    '(772) 985-6667', '(772) 207-1655'),
    '(772) 834-0117', '(772) 207-1655'),
    '(772) 834-7637', '(772) 207-1655'),
    '+17729856667', '+17722071655')
WHERE body LIKE '%985-6667%'
   OR body LIKE '%834-0117%'
   OR body LIKE '%834-7637%'
   OR body LIKE '%17729856667%';

UPDATE email_templates SET
  subject = REPLACE(subject, '(772) 985-6667', '(772) 207-1655')
WHERE subject LIKE '%985-6667%';

UPDATE email_templates SET
  sms_body = REPLACE(REPLACE(REPLACE(REPLACE(sms_body,
    '(772) 985-6667', '(772) 207-1655'),
    '(772) 834-0117', '(772) 207-1655'),
    '(772) 834-7637', '(772) 207-1655'),
    '+17729856667', '+17722071655')
WHERE sms_body LIKE '%985-6667%'
   OR sms_body LIKE '%834-0117%'
   OR sms_body LIKE '%834-7637%'
   OR sms_body LIKE '%17729856667%';

-- ────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually after applying)
-- ────────────────────────────────────────────────────────────────────────────
--
-- 1. No old numbers remain in template bodies:
--    SELECT stage, name FROM email_templates
--    WHERE body LIKE '%985-6667%' OR body LIKE '%834-0117%' OR body LIKE '%834-7637%';
--    -- expect: 0 rows
--
-- 2. No old numbers remain in SMS bodies:
--    SELECT stage, name FROM email_templates
--    WHERE sms_body LIKE '%985-6667%' OR sms_body LIKE '%834-0117%' OR sms_body LIKE '%834-7637%';
--    -- expect: 0 rows
--
-- 3. New number is present where contact info should be:
--    SELECT stage, COUNT(*) FROM email_templates
--    WHERE body LIKE '%207-1655%' OR sms_body LIKE '%207-1655%'
--    GROUP BY stage;
--    -- expect: rows for booking_approved, pickup_reminder, ready_for_pickup, etc.
