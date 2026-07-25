CREATE TYPE "public"."image_to_video_aspect" AS ENUM('16:9', '9:16', '1:1');--> statement-breakpoint
CREATE TYPE "public"."image_to_video_motion" AS ENUM('subtle', 'balanced', 'dynamic');--> statement-breakpoint
CREATE TYPE "public"."image_to_video_source_media_type" AS ENUM('image/jpeg', 'image/png', 'image/webp');--> statement-breakpoint
CREATE TYPE "public"."media_generation_status" AS ENUM('queued', 'generating', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "media_generation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"chat_id" uuid,
	"request_key" text NOT NULL,
	"status" "media_generation_status" DEFAULT 'queued' NOT NULL,
	"source_image_url" text NOT NULL,
	"source_media_type" "image_to_video_source_media_type" NOT NULL,
	"aspect" "image_to_video_aspect" NOT NULL,
	"motion" "image_to_video_motion" NOT NULL,
	"prompt" text NOT NULL,
	"duration_seconds" integer DEFAULT 5 NOT NULL,
	"trigger_run_id" text,
	"video_url" text,
	"video_media_type" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "media_generation_attempts_duration_ck" CHECK ("media_generation_attempts"."duration_seconds" = 5),
	CONSTRAINT "media_generation_attempts_lifecycle_ck" CHECK ((
				(
					"media_generation_attempts"."status" = 'queued'
					AND "media_generation_attempts"."started_at" IS NULL
					AND "media_generation_attempts"."completed_at" IS NULL
					AND "media_generation_attempts"."error" IS NULL
					AND "media_generation_attempts"."video_url" IS NULL
					AND "media_generation_attempts"."video_media_type" IS NULL
				)
				OR (
					"media_generation_attempts"."status" = 'generating'
					AND "media_generation_attempts"."started_at" IS NOT NULL
					AND "media_generation_attempts"."completed_at" IS NULL
					AND "media_generation_attempts"."error" IS NULL
					AND "media_generation_attempts"."video_url" IS NULL
					AND "media_generation_attempts"."video_media_type" IS NULL
				)
				OR (
					"media_generation_attempts"."status" = 'succeeded'
					AND "media_generation_attempts"."started_at" IS NOT NULL
					AND "media_generation_attempts"."completed_at" IS NOT NULL
					AND "media_generation_attempts"."error" IS NULL
					AND "media_generation_attempts"."video_url" IS NOT NULL
					AND "media_generation_attempts"."video_media_type" IS NOT NULL
				)
				OR (
					"media_generation_attempts"."status" = 'failed'
					AND "media_generation_attempts"."completed_at" IS NOT NULL
					AND "media_generation_attempts"."error" IS NOT NULL
					AND "media_generation_attempts"."video_url" IS NULL
					AND "media_generation_attempts"."video_media_type" IS NULL
				)
			))
);
--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD CONSTRAINT "media_generation_attempts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD CONSTRAINT "media_generation_attempts_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_generation_attempts_project_idx" ON "media_generation_attempts" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "media_generation_attempts_chat_idx" ON "media_generation_attempts" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "media_generation_attempts_status_created_idx" ON "media_generation_attempts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "media_generation_attempts_status_started_idx" ON "media_generation_attempts" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_generation_attempts_chat_request_uq" ON "media_generation_attempts" USING btree ("chat_id","request_key");