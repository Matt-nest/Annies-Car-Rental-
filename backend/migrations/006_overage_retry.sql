-- 006_overage_retry.sql
-- Adds retry tracking to pending_overage_charges so a declined off-session
-- incidental charge is retried up to MAX_RETRIES times, RETRY_DELAY apart,
-- before giving up. See cardOnFileService.processSingleCharge.
--
-- Apply via Supabase SQL editor (idempotent — uses IF NOT EXISTS guards).

-- Number of charge attempts made so far (0 = never charged yet).
ALTER TABLE pending_overage_charges
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0;
