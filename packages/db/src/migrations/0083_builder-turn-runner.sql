CREATE TYPE "public"."builder_turn_runner" AS ENUM('trigger', 'host');--> statement-breakpoint
ALTER TABLE "builder_turns" ADD COLUMN "runner" "builder_turn_runner" DEFAULT 'trigger' NOT NULL;