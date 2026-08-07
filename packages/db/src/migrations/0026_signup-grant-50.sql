ALTER TABLE "product_settings" ALTER COLUMN "signup_grant_credits" SET DEFAULT 50;
--> statement-breakpoint
-- Pricing v2: lift the live settings row from the old 20-credit grant to the
-- new 50-credit ($2 at $0.04/credit) grant. Only touch rows still on the old
-- default so a deliberately customized value is preserved.
UPDATE "product_settings" SET "signup_grant_credits" = 50 WHERE "signup_grant_credits" = 20;