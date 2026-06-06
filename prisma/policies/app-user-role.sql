-- ============================================================
-- EduOps AI — Create app_user role for Prisma connection
-- This role does NOT bypass RLS, so policies are actually enforced.
-- Replace <PASSWORD> with a strong password and update DATABASE_URL.
-- ============================================================

-- Create role (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'REPLACE_ME' NOBYPASSRLS INHERIT;
  END IF;
END
$$;

-- Inherit from authenticated so it has the same table-level GRANTs
GRANT authenticated TO app_user;

-- Explicit privileges on the public schema (defensive — should already be inherited)
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_user;
