ALTER TYPE "public"."page_generation_status" ADD VALUE IF NOT EXISTS 'canceled';--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN IF NOT EXISTS "failure_code" text;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN IF NOT EXISTS "last_progress_percent" integer;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD COLUMN IF NOT EXISTS "dismissed_at" timestamp with time zone;