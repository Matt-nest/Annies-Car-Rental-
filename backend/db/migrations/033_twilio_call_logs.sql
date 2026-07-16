-- Migration 033 — Persistent Twilio call logs
-- Stores voice webhook events so the dashboard has call history even after
-- Twilio's API retention window or when Twilio API credentials are unavailable.

CREATE TABLE IF NOT EXISTS twilio_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT UNIQUE,
  parent_call_sid TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  status TEXT,
  from_number TEXT,
  to_number TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  recording_duration_seconds INTEGER,
  transcription_text TEXT,
  transcription_status TEXT,
  price NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_created_at
  ON twilio_call_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_customer
  ON twilio_call_logs (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_status
  ON twilio_call_logs (status);

ALTER TABLE twilio_call_logs ENABLE ROW LEVEL SECURITY;
