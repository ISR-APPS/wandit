ALTER TABLE "session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "user_createdAt_idx" ON "user" USING btree ("created_at");--> statement-breakpoint
-- Backfill from the sessions that still exist, so the admin dashboard is not
-- blank on day one. Sessions are transient (deleted on sign-out and wiped by
-- the ban sweep), which is exactly why the value now lives on "user".
UPDATE "user" SET "last_seen_at" = (
	SELECT greatest(max(s."created_at"), max(s."updated_at"))
	FROM "session" s
	WHERE s."user_id" = "user"."id"
);