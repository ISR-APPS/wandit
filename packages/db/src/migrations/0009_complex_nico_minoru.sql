CREATE TABLE "lead_sheet_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"spreadsheet_id" text NOT NULL,
	"spreadsheet_url" text NOT NULL,
	"last_synced_at" timestamp with time zone,
	"synced_lead_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_sheet_syncs" ADD CONSTRAINT "lead_sheet_syncs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_sheet_syncs_projectId_uq" ON "lead_sheet_syncs" USING btree ("project_id");