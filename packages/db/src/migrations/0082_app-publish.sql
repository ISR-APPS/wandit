CREATE TYPE "public"."app_build_status" AS ENUM('queued', 'building', 'uploading', 'published', 'blocked', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deployment_kind" AS ENUM('page', 'app');--> statement-breakpoint
CREATE TABLE "app_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"status" "app_build_status" DEFAULT 'queued' NOT NULL,
	"commit_sha" text NOT NULL,
	"source_build_id" uuid,
	"error_code" text,
	"error_message" text,
	"file_count" integer,
	"bytes" integer,
	"trigger_run_id" text,
	"request_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "deployments" ALTER COLUMN "version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "kind" "deployment_kind" DEFAULT 'page' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "build_id" uuid;--> statement-breakpoint
ALTER TABLE "deployments" ADD COLUMN "commit_sha" text;--> statement-breakpoint
ALTER TABLE "app_builds" ADD CONSTRAINT "app_builds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_builds" ADD CONSTRAINT "app_builds_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_builds" ADD CONSTRAINT "app_builds_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_builds" ADD CONSTRAINT "app_builds_source_build_id_app_builds_id_fk" FOREIGN KEY ("source_build_id") REFERENCES "public"."app_builds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_builds_live_project_uq" ON "app_builds" USING btree ("project_id") WHERE "app_builds"."status" IN ('queued', 'building', 'uploading');--> statement-breakpoint
CREATE UNIQUE INDEX "app_builds_projectId_requestKey_uq" ON "app_builds" USING btree ("project_id","request_key");--> statement-breakpoint
CREATE INDEX "app_builds_projectId_createdAt_idx" ON "app_builds" USING btree ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_build_id_app_builds_id_fk" FOREIGN KEY ("build_id") REFERENCES "public"."app_builds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_kind_source_ck" CHECK (("deployments"."kind" = 'page' AND "deployments"."version_id" IS NOT NULL) OR ("deployments"."kind" = 'app' AND "deployments"."build_id" IS NOT NULL AND "deployments"."commit_sha" IS NOT NULL));