CREATE TYPE "public"."cancellation_reason_code" AS ENUM('too_expensive', 'not_using_enough', 'missing_features', 'technical_issues', 'switching_provider', 'temporary_pause', 'other');--> statement-breakpoint
CREATE TYPE "public"."cancellation_reason_status" AS ENUM('pending', 'scheduled', 'resumed', 'ended', 'provider_failed');--> statement-breakpoint
CREATE TYPE "public"."connector_operation_feature" AS ENUM('ads_analysis', 'ads_launch', 'other');--> statement-breakpoint
CREATE TYPE "public"."connector_operation_status" AS ENUM('succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."product_event_kind" AS ENUM('pricing_viewed', 'upgrade_clicked');--> statement-breakpoint
CREATE TABLE "cancellation_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"stripe_subscription_id" text NOT NULL,
	"subscription_user_id" text NOT NULL,
	"organization_id" text,
	"submitted_by_user_id" text NOT NULL,
	"reason" "cancellation_reason_code" NOT NULL,
	"details" text,
	"status" "cancellation_reason_status" NOT NULL,
	"ended_state_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_operation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"connector_slug" text NOT NULL,
	"tool_name" text NOT NULL,
	"feature" "connector_operation_feature" NOT NULL,
	"status" "connector_operation_status" NOT NULL,
	"error_code" text,
	"error_message" text,
	"chat_id" uuid,
	"message_id" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_costs" (
	"month" date PRIMARY KEY NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"ad_spend_by_source_cents" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"infrastructure_cost_cents" integer DEFAULT 0 NOT NULL,
	"other_cost_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_costs_month_first_day_ck" CHECK (extract(day from "monthly_costs"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "product_event_kind" NOT NULL,
	"surface" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cancellation_reasons" ADD CONSTRAINT "cancellation_reasons_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_reasons" ADD CONSTRAINT "cancellation_reasons_ended_state_event_id_subscription_state_events_id_fk" FOREIGN KEY ("ended_state_event_id") REFERENCES "public"."subscription_state_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_operation_events" ADD CONSTRAINT "connector_operation_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_operation_events" ADD CONSTRAINT "connector_operation_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_costs" ADD CONSTRAINT "monthly_costs_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_costs" ADD CONSTRAINT "monthly_costs_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cancellation_reasons_stripeSubscriptionId_createdAt_idx" ON "cancellation_reasons" USING btree ("stripe_subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "cancellation_reasons_endedStateEventId_idx" ON "cancellation_reasons" USING btree ("ended_state_event_id");--> statement-breakpoint
CREATE INDEX "connector_operation_events_connectorSlug_createdAt_idx" ON "connector_operation_events" USING btree ("connector_slug","created_at");--> statement-breakpoint
CREATE INDEX "connector_operation_events_feature_status_createdAt_idx" ON "connector_operation_events" USING btree ("feature","status","created_at");--> statement-breakpoint
CREATE INDEX "connector_operation_events_userId_createdAt_idx" ON "connector_operation_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_events_idempotency_uq" ON "product_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "product_events_kind_createdAt_idx" ON "product_events" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "product_events_userId_kind_idx" ON "product_events" USING btree ("user_id","kind");