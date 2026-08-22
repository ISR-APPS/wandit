ALTER TABLE "media_generation_attempts" DROP CONSTRAINT "media_generation_attempts_duration_ck";--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "quality" text;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD COLUMN "talking" boolean;--> statement-breakpoint
ALTER TABLE "media_generation_attempts" ADD CONSTRAINT "media_generation_attempts_duration_ck" CHECK ("media_generation_attempts"."duration_seconds" IN (5, 10, 15));