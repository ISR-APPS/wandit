/**
 * Git history of a V2 project: one row per commit and one row per branch.
 * The `builder-turn` task writes commits after each push to code.storage.
 * The versions list and the restore flow read them.
 * No `app_bundles` table exists: D21 keeps the history on code.storage, not
 * in R2.
 */
import { relations } from "drizzle-orm";
import {
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { builderTurns } from "./builder-turns";
import { chats } from "./chats";
import { organization } from "./organizations";
import { projects } from "./projects";

/**
 * What made the commit: an agent turn, a restore, a work-in-progress
 * snapshot, or a merge.
 */
export const appCommitSource = pgEnum("app_commit_source", [
	"agent",
	"restore",
	"wip",
	"merge",
]);

export const appCommits = pgTable(
	"app_commits",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Restrict, not cascade: history must survive account rows.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the project belongs to an org workspace.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// The project the commit belongs to. Cascade: a deleted project loses
		// it.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// The chat whose turn made the commit. Set null keeps history.
		chatId: uuid("chat_id").references(() => chats.id, {
			onDelete: "set null",
		}),
		// The builder turn that made the commit. Set null keeps history.
		turnId: uuid("turn_id").references(() => builderTurns.id, {
			onDelete: "set null",
		}),
		// Id of the `messages` row whose turn produced the commit.
		messageId: text("message_id"),
		// Commit sha on the code.storage repository.
		sha: text("sha").notNull(),
		// Parent commit sha. Null on the root commit.
		parentSha: text("parent_sha"),
		// Commit message.
		message: text("message").notNull(),
		source: appCommitSource("source").notNull(),
		// For `source = 'restore'`: the sha the working tree went back to.
		restoredFromSha: text("restored_from_sha"),
		// Files changed with insertions and deletions (git numstat).
		numstat: jsonb("numstat"),
		// R2 key of the patch text, for the diff view.
		patchKey: text("patch_key"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// A sha never repeats inside a project.
		uniqueIndex("app_commits_projectId_sha_uq").on(table.projectId, table.sha),
		// Version list of one project, ordered by time.
		index("app_commits_projectId_createdAt_idx").on(
			table.projectId,
			table.createdAt,
		),
		// FK target so later V2 rows can prove they share the commit's
		// project.
		uniqueIndex("app_commits_projectId_id_uq").on(table.projectId, table.id),
	],
);

export const appBranches = pgTable(
	"app_branches",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Restrict, not cascade: history must survive account rows.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the project belongs to an org workspace.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// The project the branch belongs to. Cascade: a deleted project loses
		// it.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Branch name on the code.storage repository.
		name: text("name").notNull(),
		// Commit the branch points at. Null until the first push.
		headSha: text("head_sha"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// A branch name never repeats inside a project.
		uniqueIndex("app_branches_projectId_name_uq").on(
			table.projectId,
			table.name,
		),
		// FK target so later V2 rows can prove they share the branch's
		// project.
		uniqueIndex("app_branches_projectId_id_uq").on(table.projectId, table.id),
	],
);

export const appCommitsRelations = relations(appCommits, ({ one }) => ({
	user: one(user, {
		fields: [appCommits.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [appCommits.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [appCommits.projectId],
		references: [projects.id],
	}),
	chat: one(chats, {
		fields: [appCommits.chatId],
		references: [chats.id],
	}),
	turn: one(builderTurns, {
		fields: [appCommits.turnId],
		references: [builderTurns.id],
	}),
}));

export const appBranchesRelations = relations(appBranches, ({ one }) => ({
	user: one(user, {
		fields: [appBranches.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [appBranches.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [appBranches.projectId],
		references: [projects.id],
	}),
}));
