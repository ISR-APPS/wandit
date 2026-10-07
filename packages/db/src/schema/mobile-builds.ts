/**
 * One EAS build of a V2 mobile app (WANDIT-194).
 * The mobile builds API inserts the row; the `mobile-build` Trigger task
 * moves it through its states. The Android card of the publish popover
 * reads it.
 */
import { relations, sql } from "drizzle-orm";
import {
	index,
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

/** Target OS of a build. Only `android` builds run before WANDIT-284. */
export const mobileBuildPlatform = pgEnum("mobile_build_platform", [
	"android",
	"ios",
]);

/**
 * What the build makes: `apk` is an Android install file with internal
 * distribution; `ios_store` is a TestFlight build (WANDIT-284).
 */
export const mobileBuildKind = pgEnum("mobile_build_kind", [
	"apk",
	"ios_store",
]);

/**
 * Lifecycle of one build. `queued` and `building` are the live states: at
 * most one row per project and platform may sit in them.
 */
export const mobileBuildStatus = pgEnum("mobile_build_status", [
	"queued",
	"building",
	"finished",
	"failed",
	"canceled",
]);

export const mobileBuilds = pgTable(
	"mobile_builds",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// The user who asked for the build. Restrict, not cascade: the credit
		// history of the build must survive account rows.
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
		platform: mobileBuildPlatform("platform").notNull(),
		kind: mobileBuildKind("kind").notNull(),
		status: mobileBuildStatus("status").notNull().default("queued"),
		// Head of `main` on code.storage when the user asked for the build.
		// The task clones this commit.
		commitSha: text("commit_sha").notNull(),
		// EAS build id. Null until `eas build` queued the build.
		easBuildId: text("eas_build_id"),
		// Direct download URL of the APK. Set when EAS reports FINISHED.
		artifactUrl: text("artifact_url"),
		// Machine failure code, one of `mobileBuildErrorCodes` in
		// packages/contracts, for example `eas_errored`.
		errorCode: text("error_code"),
		// English failure detail for support; the API does not send it. Never
		// holds a token or a secret.
		errorMessage: text("error_message"),
		// Trigger.dev run id of the `mobile-build` task.
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
		// When the build reached `finished`, `failed`, or `canceled`.
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		// One live build per project and platform. `liveMobileBuildStatuses`
		// in packages/contracts copies this list.
		uniqueIndex("mobile_builds_live_project_platform_uq")
			.on(table.projectId, table.platform)
			.where(sql`${table.status} IN ('queued', 'building')`),
		// Postgres treats two nulls as distinct, so rows without an EAS id
		// pass.
		uniqueIndex("mobile_builds_easBuildId_uq").on(table.easBuildId),
		uniqueIndex("mobile_builds_projectId_requestKey_uq").on(
			table.projectId,
			table.requestKey,
		),
		// Build history of one project, newest first.
		index("mobile_builds_projectId_createdAt_idx").on(
			table.projectId,
			table.createdAt,
		),
	],
);

export const mobileBuildsRelations = relations(mobileBuilds, ({ one }) => ({
	user: one(user, {
		fields: [mobileBuilds.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [mobileBuilds.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [mobileBuilds.projectId],
		references: [projects.id],
	}),
}));
