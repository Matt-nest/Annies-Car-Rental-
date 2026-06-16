-- 026_documents.sql
-- Per-customer / per-booking document archive. Every generated contract and
-- settlement invoice PDF is persisted to the private `documents` storage bucket
-- (created in code via documentService.ensureBucket) and recorded here, giving
-- each customer a folder of every contract + invoice ever generated. Immutable
-- legal record — rows are insert-only; regenerating a doc inserts a NEW version.

CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  type          VARCHAR(20) NOT NULL,            -- 'contract' | 'invoice'
  booking_code  VARCHAR(20),
  file_path     TEXT NOT NULL,                   -- storage path in the `documents` bucket
  file_name     TEXT NOT NULL,                   -- human filename for download
  generated_by  VARCHAR(120),                    -- admin email, or 'system'
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_booking  ON documents (booking_id, created_at DESC);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
