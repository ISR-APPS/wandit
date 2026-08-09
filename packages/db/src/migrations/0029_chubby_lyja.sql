-- Snapshot repair: 0028 was hand-written without regenerating the drizzle
-- snapshot, so `drizzle-kit generate` kept re-emitting this index. Any
-- database that ran 0028 already has it — IF NOT EXISTS makes this a no-op.
CREATE INDEX IF NOT EXISTS "leads_createdAt_id_idx" ON "leads" USING btree ("created_at","id");
