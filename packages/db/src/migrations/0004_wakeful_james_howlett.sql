CREATE TYPE "public"."lead_scrape_stage" AS ENUM('queued', 'searching', 'extracting', 'verifying', 'exporting');--> statement-breakpoint
CREATE TYPE "public"."lead_scrape_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "lead_scrape_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chat_id" uuid,
	"status" "lead_scrape_status" DEFAULT 'queued' NOT NULL,
	"stage" "lead_scrape_stage" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"spec" jsonb NOT NULL,
	"trigger_run_id" text,
	"found_count" integer DEFAULT 0 NOT NULL,
	"row_count" integer,
	"column_count" integer,
	"file_name" text,
	"file_size" integer,
	"r2_key" text,
	"preview_rows" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lead_scrape_attempts" ADD CONSTRAINT "lead_scrape_attempts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scrape_attempts" ADD CONSTRAINT "lead_scrape_attempts_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_scrape_attempts_project_idx" ON "lead_scrape_attempts" USING btree ("project_id","created_at");