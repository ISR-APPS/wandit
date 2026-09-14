/**
 * The hidden Supabase project of one V2 user app (D18).
 * The provisioning task at project creation writes the row.
 * The Cloud tab and the backend tools read it.
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

/** Backend vendor. `supabase` is the only value today. */
export const appBackendProvider = pgEnum("app_backend_provider", ["supabase"]);

/**
 * Lifecycle of the provider project. `creating`, `active`, `paused`, and
 * `restoring` still count as owned backends; `deleting` and `error` do not
 * serve the app.
 */
export const appBackendStatus = pgEnum("app_backend_status", [
	"creating",
	"active",
	"paused",
	"restoring",
	"deleting",
	"error",
]);

export const appBackends = pgTable(
	"app_backends",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Restrict, not cascade: provisioning history must survive account rows.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the project belongs to an org workspace.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// One project has at most one backend. Cascade: a deleted project
		// loses it.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		provider: appBackendProvider("provider").notNull().default("supabase"),
		// Supabase project ref. Null while provisioning runs.
		ref: text("ref"),
		// Supabase region of the project. D8 picks it from the user IP.
		region: text("region").notNull(),
		// Id of the wandit organization on the Supabase platform account.
		orgId: text("org_id"),
		status: appBackendStatus("status").notNull().default("creating"),
		// Public anon key the app uses in the browser. Not a secret.
		anonKey: text("anon_key"),
		// Id of the `project_secrets` row that holds the service-role key.
		// No FK: WANDIT-185 adds that table and the keys.
		serviceRoleSecretId: uuid("service_role_secret_id"),
		// Id of the `project_secrets` row that holds the database password.
		// No FK: WANDIT-185 adds that table and the keys.
		dbPasswordSecretId: uuid("db_password_secret_id"),
		// Database host of the Supabase project.
		dbHost: text("db_host"),
		// When the idle pause suspended the project.
		pausedAt: timestamp("paused_at", { withTimezone: true }),
		// Last activity the pause sweep uses.
		lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
		// When teardown started. The row stays until the provider confirms.
		deletingAt: timestamp("deleting_at", { withTimezone: true }),
		// Dedupe key of the provision request.
		requestKey: text("request_key").notNull(),
		// Trigger.dev run id of the provision task.
		triggerRunId: text("trigger_run_id"),
		// Human-readable provisioning failure reason.
		error: text("error"),
		// Machine failure code. The UI reads it to say who failed: the provider
		// or wandit.
		failureCode: text("failure_code"),
		// Coarse failure family for admin filtering.
		failureKind: text("failure_kind"),
		// Which layer failed: Supabase API, network, or task.
		failureSource: text("failure_source"),
		// External provider that reported the failure.
		failureProvider: text("failure_provider"),
		// Raw message the provider returned.
		failureProviderMessage: text("failure_provider_message"),
		// Provider-side request id for support lookups.
		failureRequestId: text("failure_request_id"),
		// Sentry event id of the failure, when the task captured one.
		sentryEventId: text("sentry_event_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("app_backends_projectId_uq").on(table.projectId),
		// Two backends never share a provider ref.
		uniqueIndex("app_backends_provider_ref_uq")
			.on(table.provider, table.ref)
			.where(sql`${table.ref} IS NOT NULL`),
		uniqueIndex("app_backends_requestKey_uq").on(table.requestKey),
		// FK target so later V2 rows can prove they share the backend's
		// project.
		uniqueIndex("app_backends_projectId_id_uq").on(table.projectId, table.id),
	],
);

export const appBackendsRelations = relations(appBackends, ({ one }) => ({
	user: one(user, {
		fields: [appBackends.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [appBackends.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [appBackends.projectId],
		references: [projects.id],
	}),
}));
