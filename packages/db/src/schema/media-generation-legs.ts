import { relations, sql } from "drizzle-orm";
import {
	check,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import {
	mediaGenerationAttempts,
	mediaGenerationStatus,
} from "./media-generation-attempts";

// Durable continuation-leg state lets retries resume after the last completed
// provider render instead of repeating paid work.
export const mediaGenerationLegs = pgTable(
	"media_generation_legs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		attemptId: uuid("attempt_id")
			.notNull()
			.references(() => mediaGenerationAttempts.id, { onDelete: "cascade" }),
		seq: integer("seq").notNull(),
		status: mediaGenerationStatus("status").notNull().default("queued"),
		model: text("model").notNull(),
		durationSeconds: integer("duration_seconds").notNull(),
		sourceFrameKey: text("source_frame_key"),
		segmentKey: text("segment_key"),
		error: text("error"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		unique("media_generation_legs_attempt_seq_uq").on(
			table.attemptId,
			table.seq,
		),
		check(
			"media_generation_legs_duration_ck",
			sql`${table.durationSeconds} IN (5, 10)`,
		),
		check(
			"media_generation_legs_lifecycle_ck",
			sql`(
				(
					${table.status} = 'queued'
					AND ${table.sourceFrameKey} IS NULL
					AND ${table.segmentKey} IS NULL
					AND ${table.error} IS NULL
					AND ${table.startedAt} IS NULL
					AND ${table.completedAt} IS NULL
				)
				OR (
					${table.status} = 'generating'
					AND ${table.startedAt} IS NOT NULL
					AND ${table.completedAt} IS NULL
					AND ${table.segmentKey} IS NULL
					AND ${table.error} IS NULL
				)
				OR (
					${table.status} = 'succeeded'
					AND ${table.startedAt} IS NOT NULL
					AND ${table.completedAt} IS NOT NULL
					AND ${table.segmentKey} IS NOT NULL
					AND ${table.error} IS NULL
				)
				OR (
					${table.status} = 'failed'
					AND ${table.completedAt} IS NOT NULL
					AND ${table.segmentKey} IS NULL
					AND ${table.error} IS NOT NULL
				)
			)`,
		),
	],
);

export const mediaGenerationLegsRelations = relations(
	mediaGenerationLegs,
	({ one }) => ({
		attempt: one(mediaGenerationAttempts, {
			fields: [mediaGenerationLegs.attemptId],
			references: [mediaGenerationAttempts.id],
		}),
	}),
);
