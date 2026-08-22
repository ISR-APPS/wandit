ALTER TYPE "public"."media_generation_kind" ADD VALUE 'video-edit';--> statement-breakpoint
ALTER TYPE "public"."media_generation_kind" ADD VALUE 'video-extension';--> statement-breakpoint
CREATE TABLE "media_generation_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"status" "media_generation_status" DEFAULT 'queued' NOT NULL,
	"model" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"source_frame_key" text,
	"segment_key" text,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_generation_legs_attempt_seq_uq" UNIQUE("attempt_id","seq"),
	CONSTRAINT "media_generation_legs_duration_ck" CHECK ("media_generation_legs"."duration_seconds" IN (5, 10)),
	CONSTRAINT "media_generation_legs_lifecycle_ck" CHECK ((
				(
					"media_generation_legs"."status" = 'queued'
					AND "media_generation_legs"."source_frame_key" IS NULL
					AND "media_generation_legs"."segment_key" IS NULL
					AND "media_generation_legs"."error" IS NULL
					AND "media_generation_legs"."started_at" IS NULL
					AND "media_generation_legs"."completed_at" IS NULL
				)
				OR (
					"media_generation_legs"."status" = 'generating'
					AND "media_generation_legs"."started_at" IS NOT NULL
					AND "media_generation_legs"."completed_at" IS NULL
					AND "media_generation_legs"."segment_key" IS NULL
					AND "media_generation_legs"."error" IS NULL
				)
				OR (
					"media_generation_legs"."status" = 'succeeded'
					AND "media_generation_legs"."started_at" IS NOT NULL
					AND "media_generation_legs"."completed_at" IS NOT NULL
					AND "media_generation_legs"."segment_key" IS NOT NULL
					AND "media_generation_legs"."error" IS NULL
				)
				OR (
					"media_generation_legs"."status" = 'failed'
					AND "media_generation_legs"."completed_at" IS NOT NULL
					AND "media_generation_legs"."segment_key" IS NULL
					AND "media_generation_legs"."error" IS NOT NULL
				)
			))
);
--> statement-breakpoint
ALTER TABLE "media_generation_attempts" DROP CONSTRAINT "media_generation_attempts_duration_ck";--> statement-breakpoint
ALTER TABLE "media_generation_attempts" DROP CONSTRAINT "media_generation_attempts_kind_ck";--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "source_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "source_video_url" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "source_video_media_type" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "source_duration_ms" integer;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "actual_duration_ms" integer;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "chain_depth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_generation_legs" ADD CONSTRAINT "media_generation_legs_attempt_id_media_generation_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."media_generation_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD CONSTRAINT "media_generation_attempts_source_attempt_id_media_generation_attempts_id_fk" FOREIGN KEY ("source_attempt_id") REFERENCES "public"."media_generation_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD CONSTRAINT "media_generation_attempts_duration_ck" CHECK ("media_generation_attempts"."duration_seconds" BETWEEN 4 AND 45);--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD CONSTRAINT "media_generation_attempts_kind_ck" CHECK ((
				(
					"media_generation_attempts"."kind" = 'image-animation'
					AND "media_generation_attempts"."source_image_url" IS NOT NULL
					AND "media_generation_attempts"."source_media_type" IS NOT NULL
					AND "media_generation_attempts"."motion" IS NOT NULL
					AND "media_generation_attempts"."duration_seconds" = 5
				)
				OR (
					"media_generation_attempts"."kind" = 'text-to-video'
					AND "media_generation_attempts"."source_image_url" IS NULL
					AND "media_generation_attempts"."source_media_type" IS NULL
				)
				OR (
					"media_generation_attempts"."kind"::text = 'video-edit'
					AND "media_generation_attempts"."source_video_url" IS NOT NULL
					AND "media_generation_attempts"."source_video_media_type" IS NOT NULL
				)
				OR (
					"media_generation_attempts"."kind"::text = 'video-extension'
					AND "media_generation_attempts"."source_video_url" IS NOT NULL
					AND "media_generation_attempts"."source_video_media_type" IS NOT NULL
				)
			));
