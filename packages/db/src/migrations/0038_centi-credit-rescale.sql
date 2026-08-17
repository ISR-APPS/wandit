-- Pricing v4 (centi-credits): the internal ledger unit changes from 1 credit
-- to 1 centi-credit (1 cc = 0.01 credit; 100 cc = 1 credit). Every stored
-- credit amount is multiplied by 100, so balances are preserved exactly
-- (37 credits -> 3700 cc). NOT touched: USD-micros columns, money cents/minor
-- columns, token counts, and subscriptions.tier_credits / pending_tier_credits
-- (whole-credit tier identity — grant writers multiply at write time). JSONB
-- credit amounts that the replay/reconcile code compares against rescaled
-- columns ARE rewritten below (credit_ledger.meta fingerprints, ai_usage_events
-- pricing_snapshot unit prices). The UPDATEs are not idempotent: the drizzle
-- journal runs this file exactly once; never re-apply it by hand.
ALTER TABLE "product_settings" ALTER COLUMN "signup_grant_credits" SET DEFAULT 5000;
--> statement-breakpoint
-- Plain x100 preserves a deliberately customized grant value too.
UPDATE "product_settings" SET "signup_grant_credits" = "signup_grant_credits" * 100;
--> statement-breakpoint
-- Balance source of truth: balance = sum(delta). Multiplying by +100 keeps
-- signs, so credit_ledger_delta_sign_chk stays satisfied.
UPDATE "credit_ledger" SET "delta" = "delta" * 100;
--> statement-breakpoint
UPDATE "credit_plan_hold_pools" SET "remaining_credits" = "remaining_credits" * 100;
--> statement-breakpoint
-- Both columns in ONE statement so credit_plan_holds_refundable_range_ck
-- never sees a half-scaled row.
UPDATE "credit_plan_holds" SET "original_credits" = "original_credits" * 100, "refundable_credits" = "refundable_credits" * 100;
--> statement-breakpoint
-- NULL final_credits (still reserved) stays NULL: NULL * 100 = NULL.
UPDATE "ai_usage_events" SET "reserved_credits" = "reserved_credits" * 100, "final_credits" = "final_credits" * 100;
--> statement-breakpoint
UPDATE "subscription_refill_slots" SET "credits" = "credits" * 100;
--> statement-breakpoint
UPDATE "billing_invoice_applications" SET "credits_delta" = "credits_delta" * 100;
--> statement-breakpoint
UPDATE "signup_grant_outbox" SET "credits" = "credits" * 100;
--> statement-breakpoint
UPDATE "organization_billing_settings" SET "default_member_monthly_credit_limit" = "default_member_monthly_credit_limit" * 100 WHERE "default_member_monthly_credit_limit" IS NOT NULL;
--> statement-breakpoint
UPDATE "organization_member_credit_limits" SET "monthly_credit_limit" = "monthly_credit_limit" * 100;
--> statement-breakpoint
-- credit_ledger.meta replay fingerprints: the idempotency replay guards compare
-- a row's delta and a NEW request's amounts against amounts stored inside
-- meta.idempotencyFingerprint / meta.refill. Those embedded amounts must move
-- to centi-credits with the delta, or every post-deploy retry of an old key
-- (Stripe webhook redelivery, refill replay, reconcile sweep) throws a
-- replay-conflict error. Ratios (capMultiplier) and non-numeric fields stay.
UPDATE "credit_ledger" SET "meta" = jsonb_set("meta", '{idempotencyFingerprint,amount}', to_jsonb((("meta"#>>'{idempotencyFingerprint,amount}')::numeric * 100)::bigint)) WHERE jsonb_typeof("meta"#>'{idempotencyFingerprint,amount}') = 'number';
--> statement-breakpoint
UPDATE "credit_ledger" SET "meta" = jsonb_set("meta", '{idempotencyFingerprint,grantedAmount}', to_jsonb((("meta"#>>'{idempotencyFingerprint,grantedAmount}')::numeric * 100)::bigint)) WHERE jsonb_typeof("meta"#>'{idempotencyFingerprint,grantedAmount}') = 'number';
--> statement-breakpoint
UPDATE "credit_ledger" SET "meta" = jsonb_set("meta", '{idempotencyFingerprint,forfeitedPlanCredits}', to_jsonb((("meta"#>>'{idempotencyFingerprint,forfeitedPlanCredits}')::numeric * 100)::bigint)) WHERE jsonb_typeof("meta"#>'{idempotencyFingerprint,forfeitedPlanCredits}') = 'number';
--> statement-breakpoint
-- bucketSplit / refundSplit are {plan,promo,topup} objects of credit amounts:
-- rewrite every numeric member, keep anything else verbatim.
UPDATE "credit_ledger" SET "meta" = jsonb_set("meta", '{idempotencyFingerprint,bucketSplit}', COALESCE((SELECT jsonb_object_agg(key, CASE WHEN jsonb_typeof(value) = 'number' THEN to_jsonb(((value#>>'{}')::numeric * 100)::bigint) ELSE value END) FROM jsonb_each("meta"#>'{idempotencyFingerprint,bucketSplit}')), '{}'::jsonb)) WHERE jsonb_typeof("meta"#>'{idempotencyFingerprint,bucketSplit}') = 'object';
--> statement-breakpoint
UPDATE "credit_ledger" SET "meta" = jsonb_set("meta", '{idempotencyFingerprint,refundSplit}', COALESCE((SELECT jsonb_object_agg(key, CASE WHEN jsonb_typeof(value) = 'number' THEN to_jsonb(((value#>>'{}')::numeric * 100)::bigint) ELSE value END) FROM jsonb_each("meta"#>'{idempotencyFingerprint,refundSplit}')), '{}'::jsonb)) WHERE jsonb_typeof("meta"#>'{idempotencyFingerprint,refundSplit}') = 'object';
--> statement-breakpoint
-- meta.refill: every member is a credit amount except capMultiplier (a ratio).
UPDATE "credit_ledger" SET "meta" = jsonb_set("meta", '{refill}', COALESCE((SELECT jsonb_object_agg(key, CASE WHEN key <> 'capMultiplier' AND jsonb_typeof(value) = 'number' THEN to_jsonb(((value#>>'{}')::numeric * 100)::bigint) ELSE value END) FROM jsonb_each("meta"#>'{refill}')), '{}'::jsonb)) WHERE jsonb_typeof("meta"#>'{refill}') = 'object';
--> statement-breakpoint
-- ai_usage_events.pricing_snapshot: reconciliation and late settlement replay
-- the queue-time unit prices creditsPerUnit / reserveFloorCredits /
-- creditsPerMinute from this JSON (top level and nested under
-- reservationPricingSnapshot). Without x100 an old fixed event would reconcile
-- at 1/100 of its price and refund the difference. usdMicrosPerCredit stays
-- (micros per WHOLE credit); units/maxDurationSeconds are counts, not credits.
UPDATE "ai_usage_events" SET "pricing_snapshot" = jsonb_set("pricing_snapshot", '{creditsPerUnit}', to_jsonb((("pricing_snapshot"#>>'{creditsPerUnit}')::numeric * 100)::bigint)) WHERE jsonb_typeof("pricing_snapshot"#>'{creditsPerUnit}') = 'number';
--> statement-breakpoint
UPDATE "ai_usage_events" SET "pricing_snapshot" = jsonb_set("pricing_snapshot", '{reserveFloorCredits}', to_jsonb((("pricing_snapshot"#>>'{reserveFloorCredits}')::numeric * 100)::bigint)) WHERE jsonb_typeof("pricing_snapshot"#>'{reserveFloorCredits}') = 'number';
--> statement-breakpoint
UPDATE "ai_usage_events" SET "pricing_snapshot" = jsonb_set("pricing_snapshot", '{creditsPerMinute}', to_jsonb((("pricing_snapshot"#>>'{creditsPerMinute}')::numeric * 100)::bigint)) WHERE jsonb_typeof("pricing_snapshot"#>'{creditsPerMinute}') = 'number';
--> statement-breakpoint
UPDATE "ai_usage_events" SET "pricing_snapshot" = jsonb_set("pricing_snapshot", '{reservationPricingSnapshot,creditsPerUnit}', to_jsonb((("pricing_snapshot"#>>'{reservationPricingSnapshot,creditsPerUnit}')::numeric * 100)::bigint)) WHERE jsonb_typeof("pricing_snapshot"#>'{reservationPricingSnapshot,creditsPerUnit}') = 'number';
--> statement-breakpoint
UPDATE "ai_usage_events" SET "pricing_snapshot" = jsonb_set("pricing_snapshot", '{reservationPricingSnapshot,reserveFloorCredits}', to_jsonb((("pricing_snapshot"#>>'{reservationPricingSnapshot,reserveFloorCredits}')::numeric * 100)::bigint)) WHERE jsonb_typeof("pricing_snapshot"#>'{reservationPricingSnapshot,reserveFloorCredits}') = 'number';
--> statement-breakpoint
UPDATE "ai_usage_events" SET "pricing_snapshot" = jsonb_set("pricing_snapshot", '{reservationPricingSnapshot,creditsPerMinute}', to_jsonb((("pricing_snapshot"#>>'{reservationPricingSnapshot,creditsPerMinute}')::numeric * 100)::bigint)) WHERE jsonb_typeof("pricing_snapshot"#>'{reservationPricingSnapshot,creditsPerMinute}') = 'number';
