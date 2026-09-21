ALTER TABLE "subscriptions" ADD COLUMN "pending_plan" "billing_plan";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_interval" "billing_interval";
--> statement-breakpoint
-- Existing schedules only supported same-interval changes. Starter tiers are
-- distinct from all Pro/Business tiers, so recover their cross-plan targets.
-- The update runs only when a schedule exists. Drizzle applies every pending
-- migration in one transaction. On a new database, 0065 adds the enum value
-- 'starter' in that same transaction, and Postgres rejects a literal of a
-- new enum value before the commit. EXECUTE parses the text only when the
-- update runs, so an empty table skips the lookup.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "subscriptions" WHERE "pending_tier_credits" IS NOT NULL) THEN
    EXECUTE $update$
      UPDATE "subscriptions"
      SET "pending_plan" = CASE
        WHEN "pending_tier_credits" IN (50, 60) THEN 'starter'::"billing_plan"
        ELSE "plan"
      END,
      "pending_interval" = "interval"
      WHERE "pending_tier_credits" IS NOT NULL
    $update$;
  END IF;
END $$;
