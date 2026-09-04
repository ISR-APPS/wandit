ALTER TABLE "product_settings" ALTER COLUMN "signup_grant_credits" SET DEFAULT 1800;--> statement-breakpoint
-- Pricing v6 amendment (2026-09-04): lift the live settings row from the 7-credit
-- (700 cc) grant to the 18-credit (1800 cc) grant. Only touch rows still on the
-- previous default so a deliberately customized value is preserved.
UPDATE "product_settings" SET "signup_grant_credits" = 1800 WHERE "signup_grant_credits" = 700;
