CREATE TYPE "public"."lifecycle_event_name" AS ENUM('signup_completed', 'first_prompt_sent', 'website_generated', 'landing_page_generated', 'image_generated', 'video_generated', 'marketing_strategy_generated', 'ads_connected', 'ads_analysis_completed', 'campaign_launched', 'credits_25_used', 'credits_40_used', 'pricing_viewed', 'upgrade_clicked', 'payment_completed');--> statement-breakpoint
CREATE TABLE "lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event" "lifecycle_event_name" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"dispatch_after" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone,
	"dropped_at" timestamp with time zone,
	"drop_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lifecycle_events_attempts_nonnegative_ck" CHECK ("lifecycle_events"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "lifecycle_emails_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product_events" ADD COLUMN "properties" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lifecycle_events_idempotency_uq" ON "lifecycle_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "lifecycle_events_due_idx" ON "lifecycle_events" USING btree ("dispatch_after","created_at") WHERE "lifecycle_events"."dispatched_at" is null and "lifecycle_events"."dropped_at" is null;--> statement-breakpoint
CREATE INDEX "lifecycle_events_user_event_dispatched_idx" ON "lifecycle_events" USING btree ("user_id","event","dispatched_at");