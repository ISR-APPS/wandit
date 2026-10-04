/**
 * One publish attempt of a V2 web app (WANDIT-178): a build of one commit,
 * or a rollback that uploads a stored build again.
 * The publish API inserts the row; the `publish-app` Trigger task moves it
 * through its states. The publish popover reads it.
 */
import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	index,
	integer,
	jsonb,
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
 * Lifecycle of one publish attempt. `queued`, `building`, and `uploading`
 * are the live states: at most one row per project may sit in them.
 * `blocked` means the publish gate refused the build output.
 */
export const appBuildStatus = pgEnum("app_build_status", [
	"queued",
	"building",
	"uploading",
	"published",
	"blocked",
	"failed",
]);

export const appBuilds = pgTable(
	"app_builds",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// The user who asked for the publish. Restrict, not cascade, like
		// `mobile_builds`: the history must survive account rows.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the project belongs to an org workspace.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// Cascade: a deleted project loses its builds.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		status: appBuildStatus("status").notNull().default("queued"),
		// The commit the build uses: the head of `main` at request time, or the
		// commit of the source build for a rollback.
		commitSha: text("commit_sha").notNull(),
		// Set on a rollback: the build whose stored output the task uploads
		// again. Null for a build from source. NO ACTION, not restrict: a
		// project purge deletes both rows in one statement and passes.
		sourceBuildId: uuid("source_build_id").references(
			(): AnyPgColumn => appBuilds.id,
		),
		// Machine failure code, one of `appBuildErrorCodes` in packages/contracts.
		errorCode: text("error_code"),
		// English failure detail for support; the API does not send it. Never
		// holds a secret: the build env carries public values only, and a
		// `blocked` row holds only the masked sample of a key.
		errorMessage: text("error_message"),
		// The publish gate findings (WANDIT-181, WANDIT-190), as an array of
		// `PublishGateFinding` from @wandit/contracts. The API parses it with
		// `publishGateFindingSchema` on read. Never holds a full secret value.
		gateFindings: jsonb("gate_findings").notNull().default(sql`'[]'::jsonb`),
		// True on an owner "Publish anyway" attempt: overridable findings do
		// not block it. The override route writes the `publish.gate_override`
		// audit row before it inserts the row.
		gateOverride: boolean("gate_override").notNull().default(false),
		// Files in the build output: Worker modules plus static assets.
		fileCount: integer("file_count"),
		// Total bytes of the build output. The task refuses more than 100 MB,
		// so an integer holds it.
		bytes: integer("bytes"),
		// Trigger.dev run id of the `publish-app` task.
		triggerRunId: text("trigger_run_id"),
		// Client key of the create request. A retried request with the same
		// key answers the same row.
		requestKey: text("request_key").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		// When the row reached `published`, `blocked`, or `failed`.
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		// One live publish per project: a publish and a rollback never upload
		// at the same time. `liveAppBuildStatuses` in packages/contracts
		// copies this list.
		uniqueIndex("app_builds_live_project_uq")
			.on(table.projectId)
			.where(sql`${table.status} IN ('queued', 'building', 'uploading')`),
		uniqueIndex("app_builds_projectId_requestKey_uq").on(
			table.projectId,
			table.requestKey,
		),
		// The latest build of one project for the popover.
		index("app_builds_projectId_createdAt_idx").on(
			table.projectId,
			table.createdAt,
		),
	],
);

export const appBuildsRelations = relations(appBuilds, ({ one }) => ({
	user: one(user, {
		fields: [appBuilds.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [appBuilds.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [appBuilds.projectId],
		references: [projects.id],
	}),
}));
