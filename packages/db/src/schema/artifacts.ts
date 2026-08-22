import { relations, sql } from "drizzle-orm";
import {
	foreignKey,
	index,
	integer,
	jsonb,
	type PgTableExtraConfigValue,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { messages } from "./chats";
import { projects } from "./projects";

// MVP generates landing pages only; image/video/strategy are added values later.
export const artifactKind = pgEnum("artifact_kind", ["landing_page"]);

export const artifacts = pgTable(
	"artifacts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// No default: when new kinds (image, video…) arrive, a forgotten field
		// must error, not silently classify as landing_page.
		kind: artifactKind("kind").notNull(),
		// Pointer to the current draft version; every generation moves it.
		// The composite FK below keeps it inside this artifact's own versions.
		activeVersionId: uuid("active_version_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	// Explicit return type: the artifacts ↔ versions composite FKs are circular,
	// which TS cannot infer through (TS7022) without this annotation.
	(table): PgTableExtraConfigValue[] => [
		index("artifacts_projectId_idx").on(table.projectId),
		// One landing-page artifact per project (MVP invariant) — also the
		// ON CONFLICT target that makes first-generation creation idempotent.
		uniqueIndex("artifacts_project_landing_uq")
			.on(table.projectId)
			.where(sql`${table.kind} = 'landing_page'`),
		// FK target so versions can prove they belong to this project.
		uniqueIndex("artifacts_id_projectId_uq").on(table.id, table.projectId),
		// NO ACTION (not set null): versions are immutable and never deleted
		// alone; an artifact delete removes both sides in one statement.
		foreignKey({
			columns: [table.id, table.activeVersionId],
			foreignColumns: [versions.artifactId, versions.id],
			name: "artifacts_active_version_fk",
		}),
	],
);

// Immutable: rows are only ever inserted, never updated or overwritten —
// rollback is always possible. No updated_at by design.
export const versions = pgTable(
	"versions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		artifactId: uuid("artifact_id").notNull(),
		// Denormalized tenant key: lets deployments prove same-project ownership
		// with a composite FK; kept honest by the composite FK to artifacts.
		projectId: uuid("project_id").notNull(),
		// Per-artifact sequence (v1, v2…), assigned in the insert transaction.
		number: integer("number").notNull(),
		// R2 key, layout `sites/{project_id}/{version_id}/index.html`.
		r2Key: text("r2_key").notNull(),
		// Assistant message that produced this version (version-switcher labels).
		messageId: text("message_id").references(() => messages.id, {
			onDelete: "set null",
		}),
		// Merchant-owned identifier captured at COD build time. Nullable keeps
		// historical and non-COD versions valid.
		productSku: text("product_sku"),
		// Page language, title… anything the UI wants without fetching the HTML.
		meta: jsonb("meta"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table): PgTableExtraConfigValue[] => [
		uniqueIndex("versions_artifactId_number_uq").on(
			table.artifactId,
			table.number,
		),
		// FK targets for artifacts.activeVersionId / deployments.versionId.
		uniqueIndex("versions_artifactId_id_uq").on(table.artifactId, table.id),
		uniqueIndex("versions_projectId_id_uq").on(table.projectId, table.id),
		// (artifactId, projectId) must be a real pair in artifacts — a version
		// cannot claim another project's artifact.
		foreignKey({
			columns: [table.artifactId, table.projectId],
			foreignColumns: [artifacts.id, artifacts.projectId],
			name: "versions_artifact_project_fk",
		}).onDelete("cascade"),
	],
);

export const artifactsRelations = relations(artifacts, ({ one, many }) => ({
	project: one(projects, {
		fields: [artifacts.projectId],
		references: [projects.id],
	}),
	versions: many(versions, { relationName: "artifact_versions" }),
	activeVersion: one(versions, {
		fields: [artifacts.activeVersionId],
		references: [versions.id],
		relationName: "artifact_active_version",
	}),
}));

export const versionsRelations = relations(versions, ({ one }) => ({
	artifact: one(artifacts, {
		fields: [versions.artifactId],
		references: [artifacts.id],
		relationName: "artifact_versions",
	}),
	project: one(projects, {
		fields: [versions.projectId],
		references: [projects.id],
	}),
	message: one(messages, {
		fields: [versions.messageId],
		references: [messages.id],
	}),
}));
