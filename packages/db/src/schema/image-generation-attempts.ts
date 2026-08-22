import { relations, sql } from "drizzle-orm";
import {
	check,
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
import { mediaGenerationStatus } from "./media-generation-attempts";
import { projects } from "./projects";

export const imageGenerationAspect = pgEnum("image_generation_aspect", [
	"1:1",
	"3:2",
	"2:3",
	"4:3",
	"4:5",
	"9:16",
	"16:9",
]);

export type GeneratedImageRef = {
	/** 1-based generation slot. Absent only on rows written before indexing. */
	index?: number;
	mediaType: string;
	url: string;
};

// Mutable lifecycle row for one standalone image-generation request (the
// chat's generate_image tool — distinct from the images the site builder
// makes inside a page build). Every generation parameter is snapshotted here
// before work starts; Trigger.dev receives only ids.
export const imageGenerationAttempts = pgTable(
	"image_generation_attempts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Losing the requesting conversation must not erase generated images.
		chatId: uuid("chat_id").references(() => chats.id, {
			onDelete: "set null",
		}),
		requestKey: text("request_key").notNull(),
		status: mediaGenerationStatus("status").notNull().default("queued"),
		// Display name shown in the chat card and the Assets tab.
		title: text("title").notNull(),
		prompt: text("prompt").notNull(),
		aspect: imageGenerationAspect("aspect").notNull(),
		count: integer("count").notNull().default(1),
		// User-owned upload URLs the generator edits/references (product photo,
		// logo). Empty array = pure text-to-image.
		sourceImageUrls: jsonb("source_image_urls")
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		// Partial while generating, authoritative on success. Entries are sorted
		// by their 1-based generation index and may omit failed slots.
		images: jsonb("images").$type<GeneratedImageRef[]>(),
		// Non-queryable snapshot extras: composer output id, options, quality.
		spec: jsonb("spec").$type<Record<string, unknown>>(),
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
		index("image_generation_attempts_createdAt_idx").on(table.createdAt),
		index("image_generation_attempts_project_idx").on(
			table.projectId,
			table.createdAt,
		),
		index("image_generation_attempts_chat_idx").on(table.chatId),
		index("image_generation_attempts_status_created_idx").on(
			table.status,
			table.createdAt,
		),
		uniqueIndex("image_generation_attempts_chat_request_uq").on(
			table.chatId,
			table.requestKey,
		),
		check(
			"image_generation_attempts_count_ck",
			sql`${table.count} between 1 and 4`,
		),
	],
);

export const imageGenerationAttemptsRelations = relations(
	imageGenerationAttempts,
	({ one }) => ({
		project: one(projects, {
			fields: [imageGenerationAttempts.projectId],
			references: [projects.id],
		}),
		chat: one(chats, {
			fields: [imageGenerationAttempts.chatId],
			references: [chats.id],
		}),
	}),
);
