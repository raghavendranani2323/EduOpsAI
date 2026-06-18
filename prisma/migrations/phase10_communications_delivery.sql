-- Phase 10: truthful communications delivery lifecycle
--
-- Preconditions:
-- 1. Apply phases 5-9 first.
-- 2. Back up the database and confirm restore access.
-- 3. Configure Meta WhatsApp webhook verification only after this migration.
--
-- Lock/performance:
-- ALTER TABLE takes a short metadata lock. The provider lookup index is built
-- concurrently and therefore this file must not be wrapped in a transaction.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS "providerStatusAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_provider_message_id_idx
  ON messages (provider, "providerMessageId")
  WHERE "providerMessageId" IS NOT NULL;

DROP POLICY IF EXISTS msg_upd ON messages;
CREATE POLICY msg_upd ON messages
  FOR UPDATE
  USING (has_role("institutionId", 'OWNER', 'ADMIN'))
  WITH CHECK (has_role("institutionId", 'OWNER', 'ADMIN'));

UPDATE messages
SET
  status = 'FAILED',
  "failedAt" = COALESCE("failedAt", NOW()),
  "providerStatusAt" = COALESCE("providerStatusAt", NOW()),
  "failureReason" = COALESCE("failureReason", 'Legacy console delivery was not verified')
WHERE "providerMessageId" LIKE 'console_%'
  AND status IN ('SENT', 'DELIVERED', 'READ');

-- Rollback:
-- DROP POLICY IF EXISTS msg_upd ON messages;
-- DROP INDEX CONCURRENTLY IF EXISTS messages_provider_message_id_idx;
-- ALTER TABLE messages DROP COLUMN IF EXISTS provider,
--   DROP COLUMN IF EXISTS "providerStatusAt",
--   DROP COLUMN IF EXISTS "deliveredAt",
--   DROP COLUMN IF EXISTS "readAt",
--   DROP COLUMN IF EXISTS "failedAt";
--
-- Staging verification:
-- 1. An unconfigured send returns 503 and creates no message rows.
-- 2. A configured send creates QUEUED rows and stores Meta message IDs.
-- 3. Signed sent/delivered/read/failed webhooks advance status monotonically.
-- 4. Invalid signatures cannot mutate messages.
-- 5. Logs contain counts only, never phone numbers or message bodies.
