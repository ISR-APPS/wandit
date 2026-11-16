ALTER TYPE "public"."app_commit_source" ADD VALUE IF NOT EXISTS 'starter';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "starter_template_id" text;