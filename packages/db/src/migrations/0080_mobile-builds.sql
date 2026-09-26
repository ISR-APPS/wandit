CREATE TYPE "public"."mobile_build_kind" AS ENUM('apk', 'ios_store');--> statement-breakpoint
CREATE TYPE "public"."mobile_build_platform" AS ENUM('android', 'ios');--> statement-breakpoint
CREATE TYPE "public"."mobile_build_status" AS ENUM('queued', 'building', 'finished', 'failed', 'canceled');--> statement-breakpoint
ALTER TYPE "public"."ai_usage_operation" ADD VALUE 'mobile_build' BEFORE 'topup_adjust';--> statement-breakpoint
CREATE TABLE "mobile_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"platform" "mobile_build_platform" NOT NULL,
	"kind" "mobile_build_kind" NOT NULL,
	"status" "mobile_build_status" DEFAULT 'queued' NOT NULL,
	"commit_sha" text NOT NULL,
	"eas_build_id" text,
	"artifact_url" text,
	"error_code" text,
	"error_message" text,
	"trigger_run_id" text,
	"request_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "mobile_builds" ADD CONSTRAINT "mobile_builds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_builds" ADD CONSTRAINT "mobile_builds_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_builds" ADD CONSTRAINT "mobile_builds_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_builds_live_project_platform_uq" ON "mobile_builds" USING btree ("project_id","platform") WHERE "mobile_builds"."status" IN ('queued', 'building');--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_builds_easBuildId_uq" ON "mobile_builds" USING btree ("eas_build_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_builds_projectId_requestKey_uq" ON "mobile_builds" USING btree ("project_id","request_key");--> statement-breakpoint
CREATE INDEX "mobile_builds_projectId_createdAt_idx" ON "mobile_builds" USING btree ("project_id","created_at");