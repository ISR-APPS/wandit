CREATE TYPE "public"."slickpay_payment_status" AS ENUM('created', 'pending', 'paid', 'fulfilled', 'failed', 'expired');--> statement-breakpoint
ALTER TYPE "public"."manual_payment_method" ADD VALUE 'slickpay' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "slickpay_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"plan" "billing_plan" NOT NULL,
	"tier_credits" integer NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"amount_dzd" integer NOT NULL,
	"dzd_per_usd_rate" integer NOT NULL,
	"invoice_id" text,
	"payment_url" text,
	"status" "slickpay_payment_status" DEFAULT 'created' NOT NULL,
	"subscription_id" uuid,
	"last_error" text,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slickpay_payments_amount_dzd_positive_ck" CHECK ("slickpay_payments"."amount_dzd" > 0)
);
--> statement-breakpoint
ALTER TABLE "slickpay_payments" ADD CONSTRAINT "slickpay_payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slickpay_payments" ADD CONSTRAINT "slickpay_payments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slickpay_payments" ADD CONSTRAINT "slickpay_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "slickpay_payments_invoiceId_uq" ON "slickpay_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "slickpay_payments_status_updatedAt_idx" ON "slickpay_payments" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "slickpay_payments_userId_createdAt_idx" ON "slickpay_payments" USING btree ("user_id","created_at");