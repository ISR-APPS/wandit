CREATE TYPE "public"."page_generation_status" AS ENUM('queued', 'generating', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "page_generation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"chat_id" uuid,
	"status" "page_generation_status" DEFAULT 'queued' NOT NULL,
	"spec" jsonb NOT NULL,
	"model" text NOT NULL,
	"trigger_run_id" text,
	"version_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD CONSTRAINT "page_generation_attempts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD CONSTRAINT "page_generation_attempts_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD CONSTRAINT "page_generation_attempts_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_generation_attempts" ADD CONSTRAINT "page_generation_attempts_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_attempts_project_idx" ON "page_generation_attempts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "page_attempts_artifact_idx" ON "page_generation_attempts" USING btree ("artifact_id");