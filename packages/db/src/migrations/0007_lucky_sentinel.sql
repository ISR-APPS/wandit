ALTER TABLE "domains" DROP CONSTRAINT "domains_provider_ck";--> statement-breakpoint
ALTER TABLE "domains" ALTER COLUMN "whois_privacy" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "domains" ALTER COLUMN "auto_renew" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "provider_order_id" text;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "provider_total_paid_usd" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "transfer_lock_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_provider_ck" CHECK ("domains"."provider" IS NULL OR "domains"."provider" IN ('namecom', 'openprovider'));--> statement-breakpoint
-- Defaults do not rewrite existing rows: legacy purchased domains would keep
-- showing auto-renew on while no renewal path exists for them.
UPDATE "domains" SET "auto_renew" = false WHERE "source" = 'purchased';