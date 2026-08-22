CREATE TYPE "public"."manual_payment_method" AS ENUM('cash_on_delivery', 'bank_transfer', 'ccp', 'baridimob', 'other');--> statement-breakpoint
CREATE TYPE "public"."manual_subscription_payment_kind" AS ENUM('initial', 'renewal');--> statement-breakpoint
CREATE TYPE "public"."manual_subscription_request_status" AS ENUM('pending', 'contacted', 'approved', 'rejected', 'canceled');--> statement-breakpoint
CREATE TABLE "manual_subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"request_id" uuid,
	"kind" "manual_subscription_payment_kind" NOT NULL,
	"method" "manual_payment_method" NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"reference" text,
	"note" text,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	"recorded_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_subscription_payments_amount_nonnegative_ck" CHECK ("manual_subscription_payments"."amount_minor" >= 0),
	CONSTRAINT "manual_subscription_payments_period_ck" CHECK ("manual_subscription_payments"."period_end" > "manual_subscription_payments"."period_start")
);
--> statement-breakpoint
CREATE TABLE "manual_subscription_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"plan" "billing_plan" NOT NULL,
	"tier_credits" integer NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"company" text,
	"country" text NOT NULL,
	"city" text,
	"preferred_payment_method" "manual_payment_method",
	"notes" text,
	"status" "manual_subscription_request_status" DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"handled_by_user_id" text,
	"handled_at" timestamp with time zone,
	"subscription_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_subscription_requests_tier_credits_positive_ck" CHECK ("manual_subscription_requests"."tier_credits" > 0)
);
--> statement-breakpoint
ALTER TABLE "product_settings" ADD COLUMN "manual_payments_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_subscription_payments" ADD CONSTRAINT "manual_subscription_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_subscription_payments" ADD CONSTRAINT "manual_subscription_payments_request_id_manual_subscription_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."manual_subscription_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_subscription_payments" ADD CONSTRAINT "manual_subscription_payments_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_subscription_requests" ADD CONSTRAINT "manual_subscription_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_subscription_requests" ADD CONSTRAINT "manual_subscription_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_subscription_requests" ADD CONSTRAINT "manual_subscription_requests_handled_by_user_id_user_id_fk" FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_subscription_requests" ADD CONSTRAINT "manual_subscription_requests_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_subscription_payments_idempotencyKey_uq" ON "manual_subscription_payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "manual_subscription_payments_subscriptionId_createdAt_idx" ON "manual_subscription_payments" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "manual_subscription_payments_createdAt_idx" ON "manual_subscription_payments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "manual_subscription_requests_status_createdAt_idx" ON "manual_subscription_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "manual_subscription_requests_userId_createdAt_idx" ON "manual_subscription_requests" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_subscription_requests_userId_open_uq" ON "manual_subscription_requests" USING btree ("user_id") WHERE "manual_subscription_requests"."status" IN ('pending', 'contacted') AND "manual_subscription_requests"."organization_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_subscription_requests_orgId_open_uq" ON "manual_subscription_requests" USING btree ("organization_id") WHERE "manual_subscription_requests"."status" IN ('pending', 'contacted') AND "manual_subscription_requests"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "subscriptions_provider_status_periodEnd_idx" ON "subscriptions" USING btree ("provider","status","current_period_end");