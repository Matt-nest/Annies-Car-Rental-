-- Pre-seed constraint: email_templates one-row-per-stage.
-- seed_rental_ops_templates.sql uses `ON CONFLICT (stage) DO UPDATE`, which
-- requires a full UNIQUE on (stage). On Annie's DB this constraint exists
-- outside the migration files; add it here so seeding works on a fresh project.
-- Idempotent — swallows "already exists".
DO $$ BEGIN
  ALTER TABLE email_templates ADD CONSTRAINT email_templates_stage_key UNIQUE (stage);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
