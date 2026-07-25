CREATE TYPE "public"."image_generation_aspect" AS ENUM('1:1', '3:2', '2:3', '4:3', '4:5', '9:16', '16:9');--> statement-breakpoint
CREATE TYPE "public"."marketing_asset_type" AS ENUM('ad-copy', 'marketing-strategy', 'video-script', 'creative-brief', 'html-asset');--> statement-breakpoint
CREATE TABLE "image_generation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chat_id" uuid,
	"request_key" text NOT NULL,
	"status" "media_generation_status" DEFAULT 'queued' NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"aspect" "image_generation_aspect" NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"source_image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"images" jsonb,
	"spec" jsonb,
	"trigger_run_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "image_generation_attempts_count_ck" CHECK ("image_generation_attempts"."count" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "marketing_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chat_id" uuid,
	"request_key" text NOT NULL,
	"status" "media_generation_status" DEFAULT 'queued' NOT NULL,
	"asset_type" "marketing_asset_type" NOT NULL,
	"name" text NOT NULL,
	"brief" text NOT NULL,
	"spec" jsonb,
	"r2_key" text,
	"trigger_run_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "image_generation_attempts" ADD CONSTRAINT "image_generation_attempts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_generation_attempts" ADD CONSTRAINT "image_generation_attempts_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_generation_attempts_project_idx" ON "image_generation_attempts" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "image_generation_attempts_chat_idx" ON "image_generation_attempts" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "image_generation_attempts_status_created_idx" ON "image_generation_attempts" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "image_generation_attempts_chat_request_uq" ON "image_generation_attempts" USING btree ("chat_id","request_key");--> statement-breakpoint
CREATE INDEX "marketing_assets_project_idx" ON "marketing_assets" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "marketing_assets_chat_idx" ON "marketing_assets" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "marketing_assets_status_created_idx" ON "marketing_assets" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_assets_chat_request_uq" ON "marketing_assets" USING btree ("chat_id","request_key");