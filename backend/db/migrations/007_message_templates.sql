-- Migration: Add channel support and SMS body to email_templates
-- Also rename to message_templates since we now support SMS

-- Add new columns
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS channel VARCHAR(10) DEFAULT 'email';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS sms_body TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20) DEFAULT 'automated';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for stage lookup
CREATE INDEX IF NOT EXISTS idx_email_templates_stage ON email_templates(stage);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

SELECT 'Migration complete: message_templates updated' AS result;
