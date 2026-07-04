CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."billing_plan" AS ENUM('pro', 'business');--> statement-breakpoint
CREATE TYPE "public"."billing_webhook_status" AS ENUM('received', 'processed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."credit_bucket" AS ENUM('plan', 'topup');--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "billing_webhook_status" NOT NULL,
	"error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"provider" text NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"plan" "billing_plan" NOT NULL,
	"tier_credits" integer NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"status" text NOT NULL,
	"price_lookup_key" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "bucket" "credit_bucket" DEFAULT 'plan' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_userId_uq" ON "billing_customers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_provider_customerId_uq" ON "billing_customers" USING btree ("provider","provider_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_providerSubscriptionId_uq" ON "subscriptions" USING btree ("provider_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_userId_nonTerminal_uq" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."status" NOT IN ('canceled', 'incomplete_expired');--> statement-breakpoint
CREATE INDEX "credit_ledger_userId_bucket_idx" ON "credit_ledger" USING btree ("user_id","bucket");