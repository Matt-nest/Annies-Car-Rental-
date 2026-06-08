-- Pre-seed prep for email_templates. On Annie's DB these were applied outside
-- the migration files; add them here so seeding works on a fresh project.

-- 1. One-row-per-stage: seed_rental_ops_templates.sql uses `ON CONFLICT (stage)
--    DO UPDATE`, which requires a full UNIQUE on (stage). Idempotent.
DO $$ BEGIN
  ALTER TABLE email_templates ADD CONSTRAINT email_templates_stage_key UNIQUE (stage);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. SMS-only templates (day_of_pickup, mid_rental_checkin, etc.) have NULL
--    subject AND body — only sms_body is set. Migration 005_006 created both
--    columns NOT NULL; relax them so SMS rows can seed. No-op if already nullable.
ALTER TABLE email_templates ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE email_templates ALTER COLUMN body    DROP NOT NULL;
