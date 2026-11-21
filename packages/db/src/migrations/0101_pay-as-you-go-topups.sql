ALTER TABLE "billing_topup_receipts" ALTER COLUMN "pack_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_subscription_requests" ALTER COLUMN "plan" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_subscription_requests" ALTER COLUMN "tier_credits" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_subscription_requests" ALTER COLUMN "interval" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "slickpay_payments" ALTER COLUMN "plan" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "slickpay_payments" ALTER COLUMN "tier_credits" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "slickpay_payments" ALTER COLUMN "interval" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_checkout_attempts" ADD COLUMN "amount_usd_cents" integer;--> statement-breakpoint
ALTER TABLE "billing_checkout_attempts" ADD COLUMN "credits" integer;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "provider" text DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "amount_usd_cents" integer;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "credits" integer;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "method" "manual_payment_method";--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "recorded_by_user_id" text;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "reversed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD COLUMN "reversed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "manual_subscription_requests" ADD COLUMN "amount_usd_cents" integer;--> statement-breakpoint
ALTER TABLE "slickpay_payments" ADD COLUMN "amount_usd_cents" integer;--> statement-breakpoint
ALTER TABLE "slickpay_payments" ADD COLUMN "credits" integer;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD CONSTRAINT "billing_topup_receipts_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD CONSTRAINT "billing_topup_receipts_request_id_manual_subscription_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."manual_subscription_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD CONSTRAINT "billing_topup_receipts_reversed_by_user_id_user_id_fk" FOREIGN KEY ("reversed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_topup_receipts_userId_paidAt_idx" ON "billing_topup_receipts" USING btree ("user_id","paid_at");--> statement-breakpoint
CREATE INDEX "billing_topup_receipts_organizationId_paidAt_idx" ON "billing_topup_receipts" USING btree ("organization_id","paid_at") WHERE "billing_topup_receipts"."organization_id" is not null;--> statement-breakpoint
ALTER TABLE "billing_checkout_attempts" ADD CONSTRAINT "billing_checkout_attempts_topup_amount_ck" CHECK (("billing_checkout_attempts"."amount_usd_cents" IS NULL AND "billing_checkout_attempts"."credits" IS NULL) OR ("billing_checkout_attempts"."amount_usd_cents" IS NOT NULL AND "billing_checkout_attempts"."credits" IS NOT NULL AND "billing_checkout_attempts"."amount_usd_cents" > 0 AND "billing_checkout_attempts"."credits" > 0));--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD CONSTRAINT "billing_topup_receipts_provider_ck" CHECK ("billing_topup_receipts"."provider" IN ('stripe', 'slickpay', 'offline'));--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD CONSTRAINT "billing_topup_receipts_credits_positive_ck" CHECK ("billing_topup_receipts"."credits" > 0);--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD CONSTRAINT "billing_topup_receipts_non_stripe_credits_ck" CHECK ("billing_topup_receipts"."provider" = 'stripe' OR "billing_topup_receipts"."credits" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD CONSTRAINT "billing_topup_receipts_amount_usd_cents_positive_ck" CHECK ("billing_topup_receipts"."amount_usd_cents" > 0);--> statement-breakpoint
ALTER TABLE "manual_subscription_requests" ADD CONSTRAINT "manual_subscription_requests_plan_or_amount_ck" CHECK (("manual_subscription_requests"."plan" IS NOT NULL AND "manual_subscription_requests"."tier_credits" IS NOT NULL AND "manual_subscription_requests"."interval" IS NOT NULL) OR ("manual_subscription_requests"."amount_usd_cents" IS NOT NULL AND "manual_subscription_requests"."amount_usd_cents" > 0));--> statement-breakpoint
ALTER TABLE "slickpay_payments" ADD CONSTRAINT "slickpay_payments_topup_amount_ck" CHECK (("slickpay_payments"."amount_usd_cents" IS NULL AND "slickpay_payments"."credits" IS NULL) OR ("slickpay_payments"."amount_usd_cents" IS NOT NULL AND "slickpay_payments"."credits" IS NOT NULL AND "slickpay_payments"."amount_usd_cents" > 0 AND "slickpay_payments"."credits" > 0));--> statement-breakpoint
ALTER TABLE "slickpay_payments" ADD CONSTRAINT "slickpay_payments_plan_or_topup_ck" CHECK (("slickpay_payments"."plan" IS NOT NULL AND "slickpay_payments"."tier_credits" IS NOT NULL AND "slickpay_payments"."interval" IS NOT NULL) OR "slickpay_payments"."credits" IS NOT NULL);