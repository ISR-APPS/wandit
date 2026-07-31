ALTER TABLE "user" ADD COLUMN "early_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Preserve access for the accounts in the launch allowlist this flag replaces.
UPDATE "user"
SET "early_access" = true
WHERE lower("email") IN ('zakisb97@gmail.com', 'ramyyoukanapro@gmail.com');
