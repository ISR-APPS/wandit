/**
 * Append-only audit trail of sensitive V2 actions.
 * Server code writes one row per recorded action.
 * Admin and security tooling reads it; nothing updates or deletes it.
 */
import { relations } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organizations";
import { projects } from "./projects";

export const auditEvents = pgTable(
	"audit_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// The user that did the action. Null means the system did it.
		// Set null keeps the trail when the user goes away.
		actorUserId: text("actor_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		// The org workspace the action touched, when any.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// Machine-readable action name.
		action: text("action").notNull(),
		// Kind of object the action touched, for example `project`.
		targetType: text("target_type").notNull(),
		// Id of the touched object inside its table.
		targetId: text("target_id"),
		// The project the action touched, when any. Set null keeps the event.
		projectId: uuid("project_id").references(() => projects.id, {
			onDelete: "set null",
		}),
		// Action-specific payload, for example before/after values and ids.
		metadata: jsonb("metadata"),
		// Client IP of the request that caused the action.
		ip: text("ip"),
		// Request id for correlation with logs.
		requestId: text("request_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("audit_events_projectId_createdAt_idx").on(
			table.projectId,
			table.createdAt,
		),
		index("audit_events_actorUserId_createdAt_idx").on(
			table.actorUserId,
			table.createdAt,
		),
		index("audit_events_action_createdAt_idx").on(
			table.action,
			table.createdAt,
		),
		// FK target so later V2 rows can prove they share the event's project.
		uniqueIndex("audit_events_projectId_id_uq").on(table.projectId, table.id),
	],
);

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
	actor: one(user, {
		fields: [auditEvents.actorUserId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [auditEvents.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [auditEvents.projectId],
		references: [projects.id],
	}),
}));
