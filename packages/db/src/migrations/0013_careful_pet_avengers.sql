CREATE TYPE "public"."connector_generation_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "connector_generation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"connector_slug" text NOT NULL,
	"tool_name" text NOT NULL,
	"args" jsonb NOT NULL,
	"status" "connector_generation_status" DEFAULT 'queued' NOT NULL,
	"trigger_run_id" text,
	"media" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "connector_generation_attempts" ADD CONSTRAINT "connector_generation_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connector_generation_attempts_user_idx" ON "connector_generation_attempts" USING btree ("user_id","created_at");