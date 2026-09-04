ALTER TABLE "product_settings" ALTER COLUMN "signup_grant_credits" SET DEFAULT 2000;--> statement-breakpoint
-- Pricing v7 (2026-09-04): lift the live settings row from the 18-credit (1800 cc)
-- grant to the 20-credit (2000 cc) grant. Only touch rows still on the previous
-- default so a deliberately customized value is preserved.
UPDATE "product_settings" SET "signup_grant_credits" = 2000 WHERE "signup_grant_credits" = 1800;
