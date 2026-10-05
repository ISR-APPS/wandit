/**
 * Encrypted secret values of one V2 app project (WANDIT-185).
 * `ProjectSecretsRepository` in the API writes and reads the rows; the
 * rotation script re-encrypts them. A value is stored as AES-256-GCM
 * ciphertext only; no route and no log ever carries the plain value.
 */
import { relations, sql } from "drizzle-orm";
import {
	check,
	integer,
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
 * Who wrote the row. `user` rows come from the Secrets panel; `system`
 * rows come from server code, and a user cannot replace or delete them.
 */
export const projectSecretKind = pgEnum("project_secret_kind", [
	"user",
	"system",
]);

export const projectSecrets = pgTable(
	"project_secrets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// The owner pair, as on `projects`: the creating member for an org
		// project. Restrict: a user with secrets is never hard-deleted.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the project belongs to an org workspace.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// Cascade: a deleted project loses its secrets.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Env-style name, for example `STRIPE_SECRET_KEY`. The check below
		// enforces the same pattern the contract validates.
		name: text("name").notNull(),
		// Base64 of the 12-byte IV, the 16-byte auth tag, and the encrypted
		// value, in that order. `projectId:name` is the authenticated data.
		ciphertext: text("ciphertext").notNull(),
		// The `APP_SECRETS_ENCRYPTION_KEY` version that encrypted the row.
		keyVersion: integer("key_version").notNull(),
		kind: projectSecretKind("kind").notNull().default("user"),
		// The user that wrote the first version; null for a `system` row or
		// after the user is deleted.
		createdBy: text("created_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		// When the current value last reached the Supabase function secrets
		// (WANDIT-186 `set_secret`). Null: never, or the value changed since.
		syncedToBackendAt: timestamp("synced_to_backend_at", {
			withTimezone: true,
		}),
	},
	(table) => [
		// One name per project; the upsert of the set route targets it.
		uniqueIndex("project_secrets_projectId_name_uq").on(
			table.projectId,
			table.name,
		),
		check(
			"project_secrets_name_ck",
			sql`${table.name} ~ '^[A-Z][A-Z0-9_]{0,63}$'`,
		),
	],
);

export const projectSecretsRelations = relations(projectSecrets, ({ one }) => ({
	user: one(user, {
		fields: [projectSecrets.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [projectSecrets.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [projectSecrets.projectId],
		references: [projects.id],
	}),
}));
