import { sql } from "drizzle-orm";
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

import { user } from "./auth";

export const lifecycleEventName = pgEnum("lifecycle_event_name", [
	"signup_completed",
	"first_prompt_sent",
	"website_generated",
	"landing_page_generated",
	"image_generated",
	"video_generated",
	"marketing_strategy_generated",
	"ads_connected",
	"ads_analysis_completed",
	"campaign_launched",
	"credits_25_used",
	"credits_40_used",
	"pricing_viewed",
	"upgrade_clicked",
	"payment_completed",
]);

export const lifecycleEvents = pgTable(
	"lifecycle_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		event: lifecycleEventName("event").notNull(),
		payload: jsonb("payload")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		idempotencyKey: text("idempotency_key").notNull(),
		dispatchAfter: timestamp("dispatch_after", { withTimezone: true })
			.notNull()
			.defaultNow(),
		dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
		droppedAt: timestamp("dropped_at", { withTimezone: true }),
		dropReason: text("drop_reason"),
		attempts: integer("attempts").notNull().default(0),
		lastError: text("last_error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("lifecycle_events_idempotency_uq").on(table.idempotencyKey),
		index("lifecycle_events_due_idx")
			.on(table.dispatchAfter, table.createdAt)
			.where(sql`${table.dispatchedAt} is null and ${table.droppedAt} is null`),
		index("lifecycle_events_user_event_dispatched_idx").on(
			table.userId,
			table.event,
			table.dispatchedAt,
		),
		check(
			"lifecycle_events_attempts_nonnegative_ck",
			sql`${table.attempts} >= 0`,
		),
	],
);
