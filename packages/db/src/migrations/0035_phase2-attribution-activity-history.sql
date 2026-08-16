CREATE TYPE "public"."billing_payment_adjustment_kind" AS ENUM('refund', 'failed_payment');--> statement-breakpoint
CREATE TYPE "public"."subscription_state_event_kind" AS ENUM('created', 'plan_changed', 'status_changed', 'cancel_scheduled', 'cancel_unscheduled', 'ended');--> statement-breakpoint
CREATE TYPE "public"."user_attribution_source" AS ENUM('cookie', 'body');--> statement-breakpoint
CREATE TABLE "billing_payment_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"kind" "billing_payment_adjustment_kind" NOT NULL,
	"stripe_object_id" text NOT NULL,
	"user_id" text,
	"organization_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"cumulative_refunded_cents" integer,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_state_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"user_id" text,
	"organization_id" text,
	"kind" "subscription_state_event_kind" NOT NULL,
	"from_lookup_key" text,
	"to_lookup_key" text,
	"from_status" text,
	"to_status" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity_days" (
	"user_id" text NOT NULL,
	"activity_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_activity_days_user_id_activity_date_pk" PRIMARY KEY("user_id","activity_date")
);
--> statement-breakpoint
CREATE TABLE "user_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"story_link_slug" text,
	"landing_path" text,
	"referrer" text,
	"country" text,
	"source" "user_attribution_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_payment_adjustments" ADD CONSTRAINT "billing_payment_adjustments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payment_adjustments" ADD CONSTRAINT "billing_payment_adjustments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_state_events" ADD CONSTRAINT "subscription_state_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_state_events" ADD CONSTRAINT "subscription_state_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_attributions" ADD CONSTRAINT "user_attributions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payment_adjustments_stripeEventId_uq" ON "billing_payment_adjustments" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "billing_payment_adjustments_occurredAt_idx" ON "billing_payment_adjustments" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "billing_payment_adjustments_kind_occurredAt_idx" ON "billing_payment_adjustments" USING btree ("kind","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_state_events_stripeEventId_uq" ON "subscription_state_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "subscription_state_events_occurredAt_idx" ON "subscription_state_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "subscription_state_events_stripeSubscriptionId_occurredAt_idx" ON "subscription_state_events" USING btree ("stripe_subscription_id","occurred_at");--> statement-breakpoint
CREATE INDEX "user_activity_days_activityDate_idx" ON "user_activity_days" USING btree ("activity_date");--> statement-breakpoint
CREATE UNIQUE INDEX "user_attributions_userId_uq" ON "user_attributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "affiliate_clicks_createdAt_idx" ON "affiliate_clicks" USING btree ("created_at");