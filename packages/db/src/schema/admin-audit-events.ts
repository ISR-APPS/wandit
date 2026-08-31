import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const adminAuditEvents = pgTable(
	"admin_audit_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		adminUserId: text("admin_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		action: text("action").notNull(),
		targetUserId: text("target_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		targetId: text("target_id"),
		requestId: text("request_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("admin_audit_events_adminUserId_createdAt_idx").on(
			table.adminUserId,
			table.createdAt,
		),
		index("admin_audit_events_targetUserId_idx").on(table.targetUserId),
		index("admin_audit_events_action_createdAt_idx").on(
			table.action,
			table.createdAt,
		),
	],
);
