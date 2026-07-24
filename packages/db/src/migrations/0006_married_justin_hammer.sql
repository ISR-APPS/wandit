ALTER TABLE "billing_customers" ADD COLUMN "open_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "provider_refund_id" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "refund_status" text;--> statement-breakpoint
CREATE INDEX "credit_ledger_chargeId_idx" ON "credit_ledger" USING btree (("meta" ->> 'chargeId'));--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_providerRefundId_uq" ON "payment_orders" USING btree ("provider_refund_id");