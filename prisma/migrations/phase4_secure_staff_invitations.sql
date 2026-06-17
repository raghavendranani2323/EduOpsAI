-- Preserve non-secret staff profile details until a secure invitation is accepted.
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS "fullName" TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS qualification TEXT;

-- Rollback:
-- ALTER TABLE invitations
--   DROP COLUMN IF EXISTS qualification,
--   DROP COLUMN IF EXISTS designation,
--   DROP COLUMN IF EXISTS phone,
--   DROP COLUMN IF EXISTS "fullName";
