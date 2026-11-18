ALTER TABLE "project_github_links" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: updated_at is the best guess for an old link. An error write also moves it, so the time can be late.
UPDATE "project_github_links" SET "last_synced_at" = "updated_at" WHERE "last_synced_sha" IS NOT NULL;
