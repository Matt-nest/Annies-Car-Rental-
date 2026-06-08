-- ============================================================================
-- Migration 000 — admin_profiles (dashboard auth / RBAC)
-- ============================================================================
-- Maps Supabase Auth users (auth.users.id) to an app role. The auth middleware
-- (backend/middleware/auth.js) looks up the profile by auth_id on every request;
-- routes/users.js manages CRUD. Migration 024 (admin_push_subscriptions) FKs
-- admin_profiles(id), so this must exist first.
--
-- Historically created outside the migration set on Annie's project — captured
-- here so a fresh client DB builds cleanly. Numbered 000 so it runs before any
-- FK that targets it. Roles: owner | admin | staff | viewer. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID NOT NULL UNIQUE,                 -- Supabase auth.users.id
  email       TEXT NOT NULL,
  first_name  TEXT,
  last_name   TEXT,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('owner','admin','staff','viewer')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by  UUID REFERENCES admin_profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_profiles_auth_id ON admin_profiles (auth_id);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
