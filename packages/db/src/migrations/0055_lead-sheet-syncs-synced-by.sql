ALTER TABLE "lead_sheet_syncs" ADD COLUMN "synced_by_user_id" text;--> statement-breakpoint
ALTER TABLE "lead_sheet_syncs" ADD CONSTRAINT "lead_sheet_syncs_synced_by_user_id_user_id_fk" FOREIGN KEY ("synced_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "lead_sheet_syncs" s SET "synced_by_user_id" = p."user_id" FROM "projects" p WHERE p."id" = s."project_id" AND p."organization_id" IS NULL AND s."synced_by_user_id" IS NULL;
