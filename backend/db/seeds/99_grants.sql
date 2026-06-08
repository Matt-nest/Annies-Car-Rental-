-- ============================================================================
-- Final step — grant the Supabase API roles access to everything in public.
-- ============================================================================
-- REQUIRED after a `DROP SCHEMA public CASCADE` reset: dropping/recreating the
-- public schema removes the default privileges that normally let service_role
-- (and anon/authenticated) read these tables, so without this every API call
-- fails with "permission denied for table …". Runs last, after all objects exist.
-- Idempotent.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated, service_role;

-- Future tables/sequences created in public inherit these grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
