// One Google Sheet per project, created by us in the merchant's Drive under
// the narrow drive.file scope (the app can only touch files it created).
// Sync is a full idempotent rewrite of the sheet, so status changes made in
// the Leads tab show up too — this row only remembers which spreadsheet is
// ours and when it was last written.
import { relations } from "drizzle-orm";
import {
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const leadSheetSyncs = pgTable(
	"lead_sheet_syncs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		spreadsheetId: text("spreadsheet_id").notNull(),
		spreadsheetUrl: text("spreadsheet_url").notNull(),
		lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
		syncedLeadCount: integer("synced_lead_count").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [uniqueIndex("lead_sheet_syncs_projectId_uq").on(table.projectId)],
);

export const leadSheetSyncsRelations = relations(leadSheetSyncs, ({ one }) => ({
	project: one(projects, {
		fields: [leadSheetSyncs.projectId],
		references: [projects.id],
	}),
}));
