CREATE TYPE "public"."desktop_build_status" AS ENUM('queued', 'preparing', 'building', 'signing', 'ready', 'failed', 'canceled', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."desktop_platform" AS ENUM('windows', 'macos');--> statement-breakpoint
ALTER TYPE "public"."ai_usage_operation" ADD VALUE 'desktop_build' BEFORE 'topup_adjust';--> statement-breakpoint
ALTER TYPE "public"."project_target_platform" ADD VALUE 'desktop';--> statement-breakpoint
CREATE TABLE "desktop_apps" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"product_name" text NOT NULL,
	"binary_name" text NOT NULL,
	"updater_key_id" text NOT NULL,
	"updater_public_key" text NOT NULL,
	"updater_private_key_ciphertext" text NOT NULL,
	"updater_key_version" integer NOT NULL,
	"current_windows_build_id" uuid,
	"current_macos_build_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desktop_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"project_id" uuid NOT NULL,
	"status" "desktop_build_status" DEFAULT 'queued' NOT NULL,
	"platform" "desktop_platform" NOT NULL,
	"release_number" integer NOT NULL,
	"version" text NOT NULL,
	"commit_sha" text NOT NULL,
	"notes" text,
	"product_name" text NOT NULL,
	"installer_key" text,
	"installer_sha256" text,
	"installer_bytes" integer,
	"updater_signature" text,
	"update_archive_key" text,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ci_run_id" text,
	"trigger_run_id" text,
	"error_code" text,
	"error_message" text,
	"request_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	CONSTRAINT "desktop_builds_releaseNumber_range" CHECK ("desktop_builds"."release_number" BETWEEN 1 AND 65535),
	CONSTRAINT "desktop_builds_update_archive_macos_only" CHECK ("desktop_builds"."platform" = 'macos' OR "desktop_builds"."update_archive_key" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "desktop_migrations" (
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"sha256" text NOT NULL,
	"first_build_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "desktop_migrations_project_id_version_pk" PRIMARY KEY("project_id","version")
);
--> statement-breakpoint
-- The composite foreign keys below need this unique index first.
CREATE UNIQUE INDEX "desktop_builds_projectId_id_uq" ON "desktop_builds" USING btree ("project_id","id");--> statement-breakpoint
ALTER TABLE "desktop_apps" ADD CONSTRAINT "desktop_apps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_apps" ADD CONSTRAINT "desktop_apps_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_apps" ADD CONSTRAINT "desktop_apps_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_apps" ADD CONSTRAINT "desktop_apps_current_windows_build_fk" FOREIGN KEY ("project_id","current_windows_build_id") REFERENCES "public"."desktop_builds"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_apps" ADD CONSTRAINT "desktop_apps_current_macos_build_fk" FOREIGN KEY ("project_id","current_macos_build_id") REFERENCES "public"."desktop_builds"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_builds" ADD CONSTRAINT "desktop_builds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_builds" ADD CONSTRAINT "desktop_builds_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_builds" ADD CONSTRAINT "desktop_builds_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_migrations" ADD CONSTRAINT "desktop_migrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desktop_migrations" ADD CONSTRAINT "desktop_migrations_first_build_fk" FOREIGN KEY ("project_id","first_build_id") REFERENCES "public"."desktop_builds"("project_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "desktop_builds_live_project_uq" ON "desktop_builds" USING btree ("project_id") WHERE "desktop_builds"."status" IN ('queued', 'preparing', 'building', 'signing');--> statement-breakpoint
CREATE UNIQUE INDEX "desktop_builds_projectId_requestKey_uq" ON "desktop_builds" USING btree ("project_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "desktop_builds_projectId_releaseNumber_uq" ON "desktop_builds" USING btree ("project_id","release_number");--> statement-breakpoint
CREATE INDEX "desktop_builds_projectId_createdAt_idx" ON "desktop_builds" USING btree ("project_id","created_at");