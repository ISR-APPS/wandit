import { relations } from "drizzle-orm";
import {
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { artifacts, versions } from "./artifacts";
import { chats } from "./chats";
import { projects } from "./projects";

// Lifecycle of one background page build. Terminal states are
// succeeded/failed; the web polls until it sees one of those.
export const pageGenerationStatus = pgEnum("page_generation_status", [
	"queued",
	"generating",
	"succeeded",
	"failed",
]);

// Mutable lifecycle row for one background page generation. Versions stay
// immutable (they are the design output); this table is where status,
// progress, and errors live — one row per generate_page call.
export const pageGenerationAttempts = pgTable(
	"page_generation_attempts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		artifactId: uuid("artifact_id")
			.notNull()
			.references(() => artifacts.id, { onDelete: "cascade" }),
		// Chat that requested the build. set null (not cascade): losing the
		// conversation should not erase the build history.
		chatId: uuid("chat_id").references(() => chats.id, {
			onDelete: "set null",
		}),
		status: pageGenerationStatus("status").notNull().default("queued"),
		// { title, brief, designerSystemPrompt } — full reproducibility: exactly
		// what the designer model was asked, snapshotted at queue time so later
		// prompt edits never change what an old attempt meant.
		spec: jsonb("spec").notNull(),
		// Model id snapshotted at queue time, same reasoning as spec.
		model: text("model").notNull(),
		// Trigger.dev run id — links this row to the run in their dashboard.
		triggerRunId: text("trigger_run_id"),
		// Set on success only. set null (not cascade): if the version ever goes
		// away we keep the attempt as history, just without its output pointer.
		versionId: uuid("version_id").references(() => versions.id, {
			onDelete: "set null",
		}),
		// Human-readable failure reason, shown in the Page tab error state.
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		// When the attempt reached a terminal state (succeeded or failed).
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("page_attempts_project_idx").on(table.projectId),
		index("page_attempts_artifact_idx").on(table.artifactId),
	],
);

export const pageGenerationAttemptsRelations = relations(
	pageGenerationAttempts,
	({ one }) => ({
		project: one(projects, {
			fields: [pageGenerationAttempts.projectId],
			references: [projects.id],
		}),
		artifact: one(artifacts, {
			fields: [pageGenerationAttempts.artifactId],
			references: [artifacts.id],
		}),
		chat: one(chats, {
			fields: [pageGenerationAttempts.chatId],
			references: [chats.id],
		}),
		version: one(versions, {
			fields: [pageGenerationAttempts.versionId],
			references: [versions.id],
		}),
	}),
);
