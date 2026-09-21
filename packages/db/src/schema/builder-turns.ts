/**
 * One row per builder turn attempt of a V2 app chat.
 * The chat endpoint writes the row at queue time.
 * The `builder-turn` Trigger.dev task updates it as the run progresses.
 * The web reads it for the turn list, the status card, and the receipt.
 */
import { relations, sql } from "drizzle-orm";
import {
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
import { builderHarness, builderSessions } from "./builder-sessions";
import { chats } from "./chats";
import { organization } from "./organizations";
import { projects } from "./projects";

/**
 * Lifecycle of one builder turn.
 * `waiting` waits for the project lock. `waiting_for_*` values block on the user.
 * `stopped_*` values name why a queued turn never ran.
 * `succeeded`, `failed`, `canceled`, `stalled`, and `stopped_*` are terminal.
 */
export const builderTurnStatus = pgEnum("builder_turn_status", [
	"queued",
	"waiting",
	"running",
	"cancelling",
	"waiting_for_answer",
	"waiting_for_approval",
	"succeeded",
	"failed",
	"canceled",
	"stalled",
	"stopped_no_credits",
	"stopped_project_cap",
	"stopped_disabled",
]);

export const builderTurns = pgTable(
	"builder_turns",
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
		// The project the turn builds. Cascade: a deleted project loses it.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// The chat the turn belongs to. Set null: turn history survives a
		// deleted chat.
		chatId: uuid("chat_id").references(() => chats.id, {
			onDelete: "set null",
		}),
		// The `builder_sessions` row the turn resumed. Set null keeps history.
		sessionId: uuid("session_id").references(() => builderSessions.id, {
			onDelete: "set null",
		}),
		// Id of the `messages` row whose submit queued the turn.
		messageId: text("message_id"),
		status: builderTurnStatus("status").notNull().default("queued"),
		// Client-generated dedupe key of the queue request. Unique per chat:
		// a retried submit reuses it.
		requestKey: text("request_key").notNull(),
		// Trigger.dev run id. Links the row to the run in their dashboard.
		triggerRunId: text("trigger_run_id"),
		// Position of the turn inside the project. Fencing: a higher number
		// wins.
		turnNumber: integer("turn_number").notNull(),
		// Coding agent that ran the turn. Null while the turn waits in the
		// queue.
		harness: builderHarness("harness"),
		// Model id the turn ran on. Null until the run reports it.
		model: text("model"),
		// Git sha the turn started from on the code.storage repository.
		inputCommitSha: text("input_commit_sha"),
		// Git sha the turn pushed. Null while running and after a failure.
		outputCommitSha: text("output_commit_sha"),
		// Token usage of the run, as the harness reports it.
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		// Prompt-cache reads. They cost less than plain input tokens.
		cacheReadTokens: integer("cache_read_tokens"),
		cacheWriteTokens: integer("cache_write_tokens"),
		// UNIT: centi-credits. Settled cost of the turn. Null until settlement.
		credits: integer("credits"),
		// Turn request snapshot: prompt, composer, attachments. Frozen at queue
		// time so later edits never change what the turn meant.
		spec: jsonb("spec").notNull(),
		// Human-readable failure reason, shown on the turn card.
		error: text("error"),
		// Machine failure code. The UI reads it to say who failed: the provider
		// or wandit.
		failureCode: text("failure_code"),
		// Coarse failure family for admin filtering.
		failureKind: text("failure_kind"),
		// Which layer failed: harness, sandbox, proxy, or task.
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
		startedAt: timestamp("started_at", { withTimezone: true }),
		// When the turn reached a terminal state.
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		// At most one active turn per project. The queue admits the next turn
		// after the current row leaves these states.
		uniqueIndex("builder_turns_active_project_uq")
			.on(table.projectId)
			.where(sql`${table.status} IN ('queued', 'running', 'cancelling')`),
		// Dedupe of a retried submit inside one chat.
		uniqueIndex("builder_turns_chatId_requestKey_uq").on(
			table.chatId,
			table.requestKey,
		),
		// Fencing: a turn number never repeats inside a project.
		uniqueIndex("builder_turns_projectId_turnNumber_uq").on(
			table.projectId,
			table.turnNumber,
		),
		// FK target so later V2 rows can prove they share the turn's project.
		uniqueIndex("builder_turns_projectId_id_uq").on(table.projectId, table.id),
		// Turn list of one project, ordered by time.
		index("builder_turns_projectId_createdAt_idx").on(
			table.projectId,
			table.createdAt,
		),
		index("builder_turns_triggerRunId_idx")
			.on(table.triggerRunId)
			.where(sql`${table.triggerRunId} IS NOT NULL`),
		// Status timeline inside one chat.
		index("builder_turns_chatId_status_idx").on(table.chatId, table.status),
	],
);

export const builderTurnsRelations = relations(builderTurns, ({ one }) => ({
	user: one(user, {
		fields: [builderTurns.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [builderTurns.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [builderTurns.projectId],
		references: [projects.id],
	}),
	chat: one(chats, {
		fields: [builderTurns.chatId],
		references: [chats.id],
	}),
	session: one(builderSessions, {
		fields: [builderTurns.sessionId],
		references: [builderSessions.id],
	}),
}));
