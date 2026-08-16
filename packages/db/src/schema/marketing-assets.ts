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
import { chats } from "./chats";
import { mediaGenerationStatus } from "./media-generation-attempts";
import { projects } from "./projects";

// Values match the composer output ids verbatim (prompt-box.tsx /
// contracts/v1/chats.ts) so no mapping layer can drift between UI, brain and
// storage.
export const marketingAssetType = pgEnum("marketing_asset_type", [
	"ad-copy",
	"marketing-strategy",
	"video-script",
	"creative-brief",
	"html-asset",
]);

// One row = one named marketing deliverable card in the Marketing tab. The
// chat tool creates a queued row before handing work to Trigger.dev; the task
// advances it and uploads the finished HTML document to R2 under r2Key.
export const marketingAssets = pgTable(
	"marketing_assets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Losing the requesting conversation must not erase generated assets.
		chatId: uuid("chat_id").references(() => chats.id, {
			onDelete: "set null",
		}),
		// Server-derived hash of the triggering message plus the stable inputs.
		// Together with chatId this deduplicates a repeated tool call and a new
		// tool call after a lost stream.
		requestKey: text("request_key").notNull(),
		status: mediaGenerationStatus("status").notNull().default("queued"),
		assetType: marketingAssetType("asset_type").notNull(),
		// Display name shown on the Marketing tab card.
		name: text("name").notNull(),
		// The complete marketing brief the Brain composed; the generator sees
		// only this snapshot, never the conversation.
		brief: text("brief").notNull(),
		// Non-queryable snapshot extras: composer options, quality tier, model.
		spec: jsonb("spec").$type<Record<string, unknown>>(),
		// Set on success: marketing/{project_id}/{asset_id}/index.html.
		r2Key: text("r2_key"),
		// Trigger.dev run id for operations/debugging; not exposed to the client.
		triggerRunId: text("trigger_run_id"),
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		// Set only when a worker atomically claims queued work — queue backlog
		// must never look like a hung provider call.
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("marketing_assets_createdAt_idx").on(table.createdAt),
		index("marketing_assets_project_idx").on(table.projectId, table.createdAt),
		index("marketing_assets_chat_idx").on(table.chatId),
		index("marketing_assets_status_created_idx").on(
			table.status,
			table.createdAt,
		),
		uniqueIndex("marketing_assets_chat_request_uq").on(
			table.chatId,
			table.requestKey,
		),
	],
);

export const marketingAssetsRelations = relations(
	marketingAssets,
	({ one }) => ({
		project: one(projects, {
			fields: [marketingAssets.projectId],
			references: [projects.id],
		}),
		chat: one(chats, {
			fields: [marketingAssets.chatId],
			references: [chats.id],
		}),
	}),
);
