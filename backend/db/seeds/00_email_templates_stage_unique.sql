-- Pre-seed prep for email_templates on fresh/local databases.
--
-- seed_rental_ops_templates.sql uses ON CONFLICT (stage), which requires a
-- full UNIQUE constraint on stage. SMS-only templates also need nullable
-- subject/body fields.

DO $$ BEGIN
  ALTER TABLE email_templates ADD CONSTRAINT email_templates_stage_key UNIQUE (stage);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE email_templates ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE email_templates ALTER COLUMN body DROP NOT NULL;
