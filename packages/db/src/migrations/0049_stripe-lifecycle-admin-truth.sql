-- WS5 (Stripe lifecycle + admin truth):
--   * billing_change_intents.anchor_reset — Ruling 7: an upgrade preview
--     decides whether the billing anchor resets and execution replays it.
--   * subscription_refill_slots cancellation provenance (replaced | clawback
--     | ownership) + the funding-charge index refunds/disputes scan by.
--   * billing_financial_reconciliation_outbox — post-grant charge rechecks
--     enqueued inside the grant transaction, drained by a sweep.
--   * billing_topup_receipts — cash record for top-up packs, backfilled from
--     the ledger at catalog prices (rows without a pack id are counted and
--     skipped: gross revenue can only understate for them).
CREATE TYPE "public"."billing_financial_reconciliation_status" AS ENUM('pending', 'done');--> statement-breakpoint
CREATE TABLE "billing_financial_reconciliation_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" text NOT NULL,
	"trigger_ref" text NOT NULL,
	"status" "billing_financial_reconciliation_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing_topup_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"pack_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"charge_id" text,
	"payment_intent_id" text,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_change_intents" ADD COLUMN "anchor_reset" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_refill_slots" ADD COLUMN "canceled_reason" text;--> statement-breakpoint
ALTER TABLE "subscription_refill_slots" ADD COLUMN "superseded_by_invoice_id" text;--> statement-breakpoint
ALTER TABLE "subscription_refill_slots" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD CONSTRAINT "billing_topup_receipts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_topup_receipts" ADD CONSTRAINT "billing_topup_receipts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_financial_reconciliation_outbox_charge_trigger_uq" ON "billing_financial_reconciliation_outbox" USING btree ("charge_id","trigger_ref");--> statement-breakpoint
CREATE INDEX "billing_financial_reconciliation_outbox_status_createdAt_idx" ON "billing_financial_reconciliation_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_topup_receipts_sessionId_uq" ON "billing_topup_receipts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "billing_topup_receipts_paidAt_idx" ON "billing_topup_receipts" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "subscription_refill_slots_fundingChargeId_status_idx" ON "subscription_refill_slots" USING btree ("funding_charge_id","status") WHERE "subscription_refill_slots"."funding_charge_id" is not null;--> statement-breakpoint
-- Backfill: one receipt per top-up purchase ledger row. The checkout attempt
-- owns the purchaser (org rows carry no user on the ledger); the catalog
-- price is keyed by pack id. Idempotent on session_id.
INSERT INTO "billing_topup_receipts" (
	"session_id", "user_id", "organization_id", "pack_id", "amount_cents",
	"currency", "charge_id", "payment_intent_id", "paid_at"
)
SELECT
	l."meta" ->> 'sessionId',
	coalesce(a."user_id", l."user_id"),
	coalesce(a."organization_id", l."organization_id"),
	l."meta" ->> 'packId',
	CASE l."meta" ->> 'packId'
		WHEN 'topup_250' THEN 2500
		WHEN 'topup_1000' THEN 10000
		WHEN 'topup_2500' THEN 25000
	END,
	'usd',
	l."meta" ->> 'chargeId',
	l."meta" ->> 'paymentIntentId',
	l."created_at"
FROM "credit_ledger" l
LEFT JOIN "billing_checkout_attempts" a ON a."provider_session_id" = l."meta" ->> 'sessionId'
WHERE l."kind" = 'topup'
	AND l."meta" ->> 'reason' = 'topup_purchase'
	AND l."meta" ->> 'sessionId' IS NOT NULL
	AND l."meta" ->> 'packId' IN ('topup_250', 'topup_1000', 'topup_2500')
	AND coalesce(a."user_id", l."user_id") IS NOT NULL
ON CONFLICT ("session_id") DO NOTHING;--> statement-breakpoint
DO $$
DECLARE
	skipped integer;
BEGIN
	SELECT count(*) INTO skipped
	FROM "credit_ledger" l
	LEFT JOIN "billing_checkout_attempts" a ON a."provider_session_id" = l."meta" ->> 'sessionId'
	WHERE l."kind" = 'topup'
		AND l."meta" ->> 'reason' = 'topup_purchase'
		AND (
			l."meta" ->> 'sessionId' IS NULL
			OR l."meta" ->> 'packId' NOT IN ('topup_250', 'topup_1000', 'topup_2500')
			OR l."meta" ->> 'packId' IS NULL
			OR coalesce(a."user_id", l."user_id") IS NULL
		);
	RAISE NOTICE 'billing_topup_receipts backfill skipped % top-up ledger row(s) without pack/session/user', skipped;
END $$;
