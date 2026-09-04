DROP TABLE "media_generation_attempts" CASCADE;--> statement-breakpoint
DROP TABLE "media_generation_legs" CASCADE;--> statement-breakpoint
ALTER TABLE "model_prices" DROP COLUMN "video_usd_micros_per_second";--> statement-breakpoint
DROP TYPE "public"."image_to_video_aspect";--> statement-breakpoint
DROP TYPE "public"."image_to_video_motion";--> statement-breakpoint
DROP TYPE "public"."image_to_video_source_media_type";--> statement-breakpoint
DROP TYPE "public"."media_generation_kind";