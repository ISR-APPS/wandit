CREATE TYPE "public"."media_generation_kind" AS ENUM('image-animation', 'text-to-video');--> statement-breakpoint
ALTER TABLE "media_generation_attempts" DROP CONSTRAINT "media_generation_attempts_duration_ck";--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ALTER COLUMN "source_image_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ALTER COLUMN "source_media_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ALTER COLUMN "motion" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "kind" "media_generation_kind" DEFAULT 'image-animation' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "voiceover" jsonb;--> statement-breakpoint
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
			));--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD CONSTRAINT "media_generation_attempts_duration_ck" CHECK ("media_generation_attempts"."duration_seconds" IN (5, 10));