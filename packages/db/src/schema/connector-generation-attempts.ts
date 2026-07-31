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
import { user } from "./auth";

// Lifecycle of one background connector generation (e.g. a Higgsfield
// generate_video call). The chat agent queues the row and answers
// immediately; a Trigger.dev task performs the blocking MCP call — minutes
// long, far past the API process's undici ceiling — and settles the row.
export const connectorGenerationStatus = pgEnum("connector_generation_status", [
	"queued",
	"running",
	"succeeded",
	"failed",
]);

// One row per intercepted generation tool call. Ownership is by user (the
// MCP connection is per-user, not per-project); the chat card reads the row
// through an ownership-checked endpoint after the run settles.
export const connectorGenerationAttempts = pgTable(
	"connector_generation_attempts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// Connector slug + tool exactly as the agent called them, plus the raw
		// arguments snapshot — the task replays this call verbatim.
		connectorSlug: text("connector_slug").notNull(),
		toolName: text("tool_name").notNull(),
		args: jsonb("args").notNull(),
		status: connectorGenerationStatus("status").notNull().default("queued"),
		// Trigger.dev run id — links this row to the run in their dashboard.
		triggerRunId: text("trigger_run_id"),
		// Set on success: https media URLs extracted from the MCP result,
		// [{ kind: "image" | "video", url }].
		media: jsonb("media"),
		// Human-readable failure reason, shown in the chat card error state.
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		// When the attempt reached a terminal state (succeeded or failed).
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("connector_generation_attempts_user_idx").on(
			table.userId,
			table.createdAt,
		),
	],
);

export const connectorGenerationAttemptsRelations = relations(
	connectorGenerationAttempts,
	({ one }) => ({
		user: one(user, {
			fields: [connectorGenerationAttempts.userId],
			references: [user.id],
		}),
	}),
);
