-- WS4 (guards, leases, idempotency): ai_usage_events grows a cross-replica
-- execution lease pair plus reconcile-retry bookkeeping; lead_scrape_attempts
-- and connector_generation_attempts grow request idempotency keys. request_key
-- stays NULLABLE in this migration: it is added, then backfilled with the
-- row's own id (unique, and a uuid can never collide with a new sha256 hex
-- key). Old replicas in the migrate-then-deploy window still insert without
-- the key, and the unique index treats NULLs as distinct. A later migration
-- tightens the column to NOT NULL once every replica writes it.
ALTER TABLE "connector_generation_attempts" ADD COLUMN "chat_id" uuid;--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD COLUMN "request_key" text;--> statement-breakpoint
UPDATE "connector_generation_attempts" SET "request_key" = "id"::text;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "execution_lease_token" uuid;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "execution_lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "reconcile_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "next_reconcile_attempt_at" timestamp with time zone;--> statement-breakpoint
-- Schedule one bounded retry cycle for today's stuck reconcile_failed rows
-- (intended, audit H3): reconciliation ledger writes are idempotent, and the
-- dead-letter cap bounds unrecoverable ones.
UPDATE "ai_usage_events" SET "next_reconcile_attempt_at" = now() WHERE "status" = 'reconcile_failed';--> statement-breakpoint
ALTER TABLE "lead_scrape_attempts" ADD COLUMN "request_key" text;--> statement-breakpoint
UPDATE "lead_scrape_attempts" SET "request_key" = "id"::text;--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD CONSTRAINT "connector_generation_attempts_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connector_generation_attempts_chat_request_uq" ON "connector_generation_attempts" USING btree ("chat_id","request_key");--> statement-breakpoint
CREATE INDEX "ai_usage_events_reconcile_failed_retry_idx" ON "ai_usage_events" USING btree ("next_reconcile_attempt_at") WHERE "ai_usage_events"."status" = 'reconcile_failed' AND "ai_usage_events"."next_reconcile_attempt_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_scrape_attempts_chat_request_uq" ON "lead_scrape_attempts" USING btree ("chat_id","request_key");
