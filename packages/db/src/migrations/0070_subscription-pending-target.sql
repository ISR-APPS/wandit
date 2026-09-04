ALTER TABLE "subscriptions" ADD COLUMN "pending_plan" "billing_plan";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_interval" "billing_interval";
--> statement-breakpoint
-- Existing schedules only supported same-interval changes. Starter tiers are
-- distinct from all Pro/Business tiers, so recover their cross-plan targets.
UPDATE "subscriptions"
SET "pending_plan" = CASE
  WHEN "pending_tier_credits" IN (50, 60) THEN 'starter'::"billing_plan"
  ELSE "plan"
END,
"pending_interval" = "interval"
WHERE "pending_tier_credits" IS NOT NULL;
