/**
 * One finished security scan of a V2 app: one row per `security_scan` turn.
 * The `builder-turn` task inserts the row at the end of a scan turn that
 * ended normally. `GET /api/v2/projects/:id/security-scans/latest` reads the
 * newest row for the Security panel.
 */
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { builderTurns } from "./builder-turns";
import { organization } from "./organizations";
import { projects } from "./projects";

export const securityScans = pgTable(
	"security_scans",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Cascade: a deleted project loses its scans.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// The scan turn. Unique: a repeated settle of the same turn inserts nothing.
		turnId: uuid("turn_id")
			.notNull()
			.unique()
			.references(() => builderTurns.id, { onDelete: "cascade" }),
		// The user who started the scan. Restrict, like the other turn rows.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the project belongs to an org workspace.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// A `SecurityScanReport` of packages/contracts. The API parses it with
		// `securityScanReportSchema` on read.
		report: jsonb("report").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// The latest scan of one project, newest first.
		index("security_scans_projectId_createdAt_idx").on(
			table.projectId,
			table.createdAt.desc(),
		),
	],
);
