/**
 * Resume state of the coding-agent harness for one V2 builder chat.
 * The `builder-turn` Trigger.dev task writes the row after each turn.
 * The next turn of the same chat reads it to resume the agent session.
 */
import { relations } from "drizzle-orm";
import {
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { chats } from "./chats";
import { organization } from "./organizations";
import { projects } from "./projects";

/**
 * Which coding agent runs the turns of a chat (D17).
 * `claude_code` is the only adapter in use. A later run tests `opencode` (D17).
 */
export const builderHarness = pgEnum("builder_harness", [
	"claude_code",
	"opencode",
]);

export const builderSessions = pgTable(
	"builder_sessions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Restrict, not cascade: usage history must survive account rows.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Set when the chat belongs to an org workspace.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// The project the session builds. Cascade: a deleted project loses it.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// One chat has at most one builder session. Cascade: the resume state
		// is useless without the chat.
		chatId: uuid("chat_id")
			.notNull()
			.references(() => chats.id, { onDelete: "cascade" }),
		// Session id of the coding agent on the harness side. Null until the
		// first turn runs.
		providerSessionId: text("provider_session_id"),
		// Opaque state that `session.detach()` returns. The task stores it, the
		// next turn reads it.
		resumeState: jsonb("resume_state"),
		// Pointer to the full transcript of the session on the harness side.
		transcriptPointer: text("transcript_pointer"),
		// Model id the session last used. Null until a turn reports it.
		model: text("model"),
		// Coding agent that runs the turns of this chat (D17).
		harness: builderHarness("harness").notNull().default("claude_code"),
		// Version of the app template the session started on.
		templateVersion: text("template_version"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("builder_sessions_chatId_uq").on(table.chatId),
		// FK target so later V2 rows can prove they share the session's project.
		uniqueIndex("builder_sessions_projectId_id_uq").on(
			table.projectId,
			table.id,
		),
	],
);

export const builderSessionsRelations = relations(
	builderSessions,
	({ one }) => ({
		user: one(user, {
			fields: [builderSessions.userId],
			references: [user.id],
		}),
		organization: one(organization, {
			fields: [builderSessions.organizationId],
			references: [organization.id],
		}),
		project: one(projects, {
			fields: [builderSessions.projectId],
			references: [projects.id],
		}),
		chat: one(chats, {
			fields: [builderSessions.chatId],
			references: [chats.id],
		}),
	}),
);
