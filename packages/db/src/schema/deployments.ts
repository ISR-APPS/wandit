import { relations, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { versions } from "./artifacts";
import { projects } from "./projects";

// Each publish attempt is its own row (ordered history). Lifecycle:
// pending → active | failed; a newer active publish marks the previous row
// superseded; unpublish marks the active row unpublished.
export const deploymentStatus = pgEnum("deployment_status", [
	"pending",
	"active",
	"failed",
	"superseded",
	"unpublished",
]);

export const deployments = pgTable(
	"deployments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// FK'd as a (projectId, versionId) pair below — a deployment can never
		// publish another project's version.
		versionId: uuid("version_id").notNull(),
		// Subdomain on the sites domain: {slug}.wandit.app.
		slug: text("slug").notNull(),
		status: deploymentStatus("status").notNull().default("pending"),
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
		index("deployments_projectId_idx").on(table.projectId),
		// The admin publish log orders the whole table by created_at desc.
		index("deployments_created_at_idx").on(table.createdAt),
		// Global slug uniqueness among LIVE sites only — a slug frees up on
		// unpublish, and history rows never block it.
		uniqueIndex("deployments_active_slug_uq")
			.on(table.slug)
			.where(sql`${table.status} = 'active'`),
		// At most one live deployment per project.
		uniqueIndex("deployments_active_project_uq")
			.on(table.projectId)
			.where(sql`${table.status} = 'active'`),
		// FK target so leads can prove their deployment is same-project.
		uniqueIndex("deployments_projectId_id_uq").on(table.projectId, table.id),
		// NO ACTION (not cascade): publish history must not vanish when versions
		// do; a full project purge deletes both sides in one statement and passes.
		foreignKey({
			columns: [table.projectId, table.versionId],
			foreignColumns: [versions.projectId, versions.id],
			name: "deployments_project_version_fk",
		}),
		// DNS labels are case-insensitive and ≤63 chars; store the canonical
		// lowercase form the edge router matches.
		check(
			"deployments_slug_dns_label_ck",
			sql`${table.slug} ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' AND char_length(${table.slug}) <= 63`,
		),
	],
);

export const deploymentsRelations = relations(deployments, ({ one }) => ({
	project: one(projects, {
		fields: [deployments.projectId],
		references: [projects.id],
	}),
	version: one(versions, {
		fields: [deployments.versionId],
		references: [versions.id],
	}),
}));
