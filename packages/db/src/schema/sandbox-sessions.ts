/**
 * Lifecycle row of one provider sandbox: the V2 dev machine of a project.
 * The sandbox lifecycle code writes it.
 * The preview proxy and the idle sweep read it.
 */
import { relations, sql } from "drizzle-orm";
import {
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organizations";
import { projects } from "./projects";

/**
 * Lifecycle of one sandbox. `creating`, `running`, and `stopped` are the
 * live states: at most one row per project may sit in them.
 */
export const sandboxSessionStatus = pgEnum("sandbox_session_status", [
	"creating",
	"running",
	"stopped",
	"expired",
	"destroyed",
	"error",
]);

export const sandboxSessions = pgTable(
	"sandbox_sessions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Restrict, not cascade: usage history must survive account rows.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the project belongs to an org workspace.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// The project the sandbox serves. Cascade: a deleted project loses it.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Sandbox vendor that runs the session, for example `vercel`.
		provider: text("provider").notNull(),
		// Id of the sandbox on the provider side. Null until create returns.
		providerSandboxId: text("provider_sandbox_id"),
		// Template image the sandbox booted from.
		image: text("image"),
		status: sandboxSessionStatus("status").notNull().default("creating"),
		// Host that serves the live app preview of the sandbox.
		previewHost: text("preview_host"),
		// When the provider stops or destroys the sandbox.
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		// When the task last persisted the sandbox disk.
		lastSnapshotAt: timestamp("last_snapshot_at", { withTimezone: true }),
		// Last turn activity. The idle sweep reads it to suspend the sandbox.
		lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
		// SHA-256 of the egress policy last pushed to the vendor. A turn on a
		// running sandbox skips the vendor update when its policy hashes equal.
		networkPolicyHash: text("network_policy_hash"),
		// Last lifecycle error, for the admin console.
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// At most one live sandbox per project.
		uniqueIndex("sandbox_sessions_live_project_uq")
			.on(table.projectId)
			.where(sql`${table.status} IN ('creating', 'running', 'stopped')`),
		// FK target so later V2 rows can prove they share the sandbox's
		// project.
		uniqueIndex("sandbox_sessions_projectId_id_uq").on(
			table.projectId,
			table.id,
		),
	],
);

export const sandboxSessionsRelations = relations(
	sandboxSessions,
	({ one }) => ({
		user: one(user, {
			fields: [sandboxSessions.userId],
			references: [user.id],
		}),
		organization: one(organization, {
			fields: [sandboxSessions.organizationId],
			references: [organization.id],
		}),
		project: one(projects, {
			fields: [sandboxSessions.projectId],
			references: [projects.id],
		}),
	}),
);
