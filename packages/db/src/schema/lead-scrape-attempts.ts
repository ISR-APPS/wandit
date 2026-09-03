import { relations } from "drizzle-orm";
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
import { chats } from "./chats";
import { projects } from "./projects";

// Lifecycle of one background lead scrape. Terminal states are
// succeeded/failed; the chat card polls until it sees one of those.
export const leadScrapeStatus = pgEnum("lead_scrape_status", [
	"queued",
	"running",
	"succeeded",
	"failed",
]);

// Pipeline position while queued/running — the task advances this as it
// works so the chat card's checklist tracks the real stages.
export const leadScrapeStage = pgEnum("lead_scrape_stage", [
	"queued",
	"searching",
	"extracting",
	"verifying",
	"exporting",
]);

// Mutable lifecycle row for one background prospect scrape — one row per
// scrape_leads call. NOT related to the inbound `leads` table: these are
// businesses WE discovered for outreach, not visitors who submitted a form.
// The scraped records themselves live only in the exported .xlsx (R2); the
// row keeps counts + a 3-row preview so the chat card renders without
// downloading the workbook.
export const leadScrapeAttempts = pgTable(
	"lead_scrape_attempts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Chat that requested the scrape. set null (not cascade): losing the
		// conversation should not erase the scrape history.
		chatId: uuid("chat_id").references(() => chats.id, {
			onDelete: "set null",
		}),
		// Request idempotency: sha256 of the spec + the AI SDK toolCallId, so a
		// duplicated tool call (transport retry, double delivery) lands on the
		// same attempt row. Pre-existing rows carry their own id as the key.
		// Nullable at the column level so old replicas in a rollout window can
		// still insert; the application always writes a key.
		requestKey: text("request_key"),
		status: leadScrapeStatus("status").notNull().default("queued"),
		stage: leadScrapeStage("stage").notNull().default("queued"),
		// 0-100, recomputed by the task as stages advance.
		progress: integer("progress").notNull().default(0),
		// What the scrape is looking for, snapshotted at queue time: query,
		// location, limit, sources, provider options.
		spec: jsonb("spec").notNull(),
		// Trigger.dev run id — links this row to the run in their dashboard.
		triggerRunId: text("trigger_run_id"),
		// Businesses discovered so far (the "N found" badge).
		foundCount: integer("found_count").notNull().default(0),
		// Set on success only.
		rowCount: integer("row_count"),
		columnCount: integer("column_count"),
		fileName: text("file_name"),
		fileSize: integer("file_size"),
		// R2 object key of the exported workbook — persisted as a key (not a
		// URL) because downloads go through an ownership-checked endpoint.
		r2Key: text("r2_key"),
		// First rows of the export ({business, phone, email}) for the card's
		// mini preview table.
		previewRows: jsonb("preview_rows"),
		// Human-readable failure reason, shown in the chat card error state.
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		startedAt: timestamp("started_at", { withTimezone: true }),
		// When the attempt reached a terminal state (succeeded or failed).
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("lead_scrape_attempts_createdAt_idx").on(table.createdAt),
		index("lead_scrape_attempts_project_idx").on(
			table.projectId,
			table.createdAt,
		),
		uniqueIndex("lead_scrape_attempts_chat_request_uq").on(
			table.chatId,
			table.requestKey,
		),
	],
);

export const leadScrapeAttemptsRelations = relations(
	leadScrapeAttempts,
	({ one }) => ({
		project: one(projects, {
			fields: [leadScrapeAttempts.projectId],
			references: [projects.id],
		}),
		chat: one(chats, {
			fields: [leadScrapeAttempts.chatId],
			references: [chats.id],
		}),
	}),
);
