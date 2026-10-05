CREATE TYPE "public"."project_suspended_reason" AS ENUM('abuse_phishing', 'abuse_malware', 'abuse_url_scan', 'legal_takedown', 'legal_notice', 'tos_violation', 'billing', 'manual_review');--> statement-breakpoint
ALTER TABLE "app_builds" ADD COLUMN "gate_findings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app_builds" ADD COLUMN "gate_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "suspended_reason_code" "project_suspended_reason";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "suspended_note" text;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_suspension_pair_ck" CHECK (("projects"."suspended_at" IS NULL) = ("projects"."suspended_reason_code" IS NULL));