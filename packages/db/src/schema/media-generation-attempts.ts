import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { projects } from "./projects";

export const mediaGenerationStatus = pgEnum("media_generation_status", [
	"queued",
	"generating",
	"succeeded",
	"failed",
]);

export const imageToVideoSourceMediaType = pgEnum(
	"image_to_video_source_media_type",
	["image/jpeg", "image/png", "image/webp"],
);

export const imageToVideoAspect = pgEnum("image_to_video_aspect", [
	"16:9",
	"9:16",
	"1:1",
]);

export const imageToVideoMotion = pgEnum("image_to_video_motion", [
	"subtle",
	"balanced",
	"dynamic",
]);

// Mutable lifecycle row for one five-second image-to-video request. Trigger.dev
// receives only this row's id plus ownership ids; every generation parameter
// is snapshotted here before work starts.
export const mediaGenerationAttempts = pgTable(
	"media_generation_attempts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Losing the requesting conversation must not erase generated media.
		chatId: uuid("chat_id").references(() => chats.id, {
			onDelete: "set null",
		}),
		// Server-derived hash of the triggering user message plus the stable
		// source/aspect/motion inputs. Together with chatId this deduplicates
		// both a repeated tool call and a new tool call after a lost stream.
		requestKey: text("request_key").notNull(),
		status: mediaGenerationStatus("status").notNull().default("queued"),
		sourceImageUrl: text("source_image_url").notNull(),
		sourceMediaType: imageToVideoSourceMediaType("source_media_type").notNull(),
		aspect: imageToVideoAspect("aspect").notNull(),
		motion: imageToVideoMotion("motion").notNull(),
		prompt: text("prompt").notNull(),
		durationSeconds: integer("duration_seconds").notNull().default(5),
		// Trigger.dev run id for operations/debugging; not exposed to the client.
		triggerRunId: text("trigger_run_id"),
		videoUrl: text("video_url"),
		videoMediaType: text("video_media_type"),
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		// Set only when a worker atomically claims queued work. Keeping this
		// separate from createdAt means queue backlog never looks like a hung
		// provider call.
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		index("media_generation_attempts_project_idx").on(
			table.projectId,
			table.createdAt,
		),
		index("media_generation_attempts_chat_idx").on(table.chatId),
		index("media_generation_attempts_status_created_idx").on(
			table.status,
			table.createdAt,
		),
		index("media_generation_attempts_status_started_idx").on(
			table.status,
			table.startedAt,
		),
		uniqueIndex("media_generation_attempts_chat_request_uq").on(
			table.chatId,
			table.requestKey,
		),
		check(
			"media_generation_attempts_duration_ck",
			sql`${table.durationSeconds} = 5`,
		),
		check(
			"media_generation_attempts_lifecycle_ck",
			sql`(
				(
					${table.status} = 'queued'
					AND ${table.startedAt} IS NULL
					AND ${table.completedAt} IS NULL
					AND ${table.error} IS NULL
					AND ${table.videoUrl} IS NULL
					AND ${table.videoMediaType} IS NULL
				)
				OR (
					${table.status} = 'generating'
					AND ${table.startedAt} IS NOT NULL
					AND ${table.completedAt} IS NULL
					AND ${table.error} IS NULL
					AND ${table.videoUrl} IS NULL
					AND ${table.videoMediaType} IS NULL
				)
				OR (
					${table.status} = 'succeeded'
					AND ${table.startedAt} IS NOT NULL
					AND ${table.completedAt} IS NOT NULL
					AND ${table.error} IS NULL
					AND ${table.videoUrl} IS NOT NULL
					AND ${table.videoMediaType} IS NOT NULL
				)
				OR (
					${table.status} = 'failed'
					AND ${table.completedAt} IS NOT NULL
					AND ${table.error} IS NOT NULL
					AND ${table.videoUrl} IS NULL
					AND ${table.videoMediaType} IS NULL
				)
			)`,
		),
	],
);

export const mediaGenerationAttemptsRelations = relations(
	mediaGenerationAttempts,
	({ one }) => ({
		project: one(projects, {
			fields: [mediaGenerationAttempts.projectId],
			references: [projects.id],
		}),
		chat: one(chats, {
			fields: [mediaGenerationAttempts.chatId],
			references: [chats.id],
		}),
	}),
);
