CREATE TYPE "public"."payment_order_kind" AS ENUM('domain_registration');--> statement-breakpoint
CREATE TYPE "public"."payment_order_status" AS ENUM('pending', 'paid', 'fulfilling', 'fulfilled', 'failed', 'canceled', 'refunded');--> statement-breakpoint
ALTER TYPE "public"."billing_webhook_status" ADD VALUE 'processing' BEFORE 'processed';--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "payment_order_kind" NOT NULL,
	"status" "payment_order_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_checkout_session_id" text,
	"provider_payment_intent_id" text,
	"provider_payment_status" text,
	"metadata" jsonb NOT NULL,
	"fulfillment_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	CONSTRAINT "payment_orders_amount_cents_positive_ck" CHECK ("payment_orders"."amount_cents" > 0),
	CONSTRAINT "payment_orders_currency_ck" CHECK ("payment_orders"."currency" = lower("payment_orders"."currency") AND char_length("payment_orders"."currency") = 3)
);
--> statement-breakpoint
ALTER TABLE "billing_webhook_events" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_webhook_events" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_webhook_events" ADD COLUMN "event_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "payment_order_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_orders_userId_createdAt_idx" ON "payment_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_orders_status_idx" ON "payment_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_providerCheckoutSessionId_uq" ON "payment_orders" USING btree ("provider_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_providerPaymentIntentId_uq" ON "payment_orders" USING btree ("provider_payment_intent_id");--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_payment_order_id_payment_orders_id_fk" FOREIGN KEY ("payment_order_id") REFERENCES "public"."payment_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_webhook_events_status_idx" ON "billing_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_ledger_paymentIntentId_idx" ON "credit_ledger" USING btree (("meta" ->> 'paymentIntentId'));