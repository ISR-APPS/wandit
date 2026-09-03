ALTER TABLE "product_settings" ALTER COLUMN "signup_grant_credits" SET DEFAULT 700;
--> statement-breakpoint
-- Pricing v6: move settings rows that still use the immediately previous
-- default to the new 7-credit grant. Preserve deliberately customized values.
UPDATE "product_settings" SET "signup_grant_credits" = 700 WHERE "signup_grant_credits" = 5000;
