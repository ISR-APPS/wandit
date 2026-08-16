import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { subscriptionStateEvents, subscriptions } from "./billing";

export const cancellationReasonCode = pgEnum("cancellation_reason_code", [
	"too_expensive",
	"not_using_enough",
	"missing_features",
	"technical_issues",
	"switching_provider",
	"temporary_pause",
	"other",
]);

export const cancellationReasonStatus = pgEnum("cancellation_reason_status", [
	"pending",
	"scheduled",
	"resumed",
	"ended",
	"provider_failed",
]);

export const cancellationReasons = pgTable(
	"cancellation_reasons",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
			onDelete: "restrict",
		}),
		stripeSubscriptionId: text("stripe_subscription_id").notNull(),
		subscriptionUserId: text("subscription_user_id").notNull(),
		organizationId: text("organization_id"),
		submittedByUserId: text("submitted_by_user_id").notNull(),
		reason: cancellationReasonCode("reason").notNull(),
		details: text("details"),
		status: cancellationReasonStatus("status").notNull(),
		endedStateEventId: uuid("ended_state_event_id").references(
			() => subscriptionStateEvents.id,
			{ onDelete: "restrict" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("cancellation_reasons_stripeSubscriptionId_createdAt_idx").on(
			table.stripeSubscriptionId,
			table.createdAt,
		),
		index("cancellation_reasons_endedStateEventId_idx").on(
			table.endedStateEventId,
		),
	],
);
