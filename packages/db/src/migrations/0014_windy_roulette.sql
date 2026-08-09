ALTER TABLE "user" ADD COLUMN "early_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Preserve access for the last launch allowlist this flag replaces
-- (ramyyoukanapro was deliberately removed from that list on dev — PR #52).
UPDATE "user"
SET "early_access" = true
WHERE lower("email") IN ('zakisb97@gmail.com');
