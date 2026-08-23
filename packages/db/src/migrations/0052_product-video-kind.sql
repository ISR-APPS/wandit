ALTER TYPE "public"."media_generation_kind" ADD VALUE 'video-product' BEFORE 'video-edit';--> statement-breakpoint
ALTER TABLE "media_generation_attempts" DROP CONSTRAINT "media_generation_attempts_kind_ck";--> statement-breakpoint
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
					"media_generation_attempts"."kind"::text = 'video-product'
					AND "media_generation_attempts"."source_image_url" IS NOT NULL
					AND "media_generation_attempts"."source_media_type" IS NOT NULL
					AND "media_generation_attempts"."duration_seconds" = 5
					AND "media_generation_attempts"."source_video_url" IS NULL
					AND "media_generation_attempts"."source_video_media_type" IS NULL
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