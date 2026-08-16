import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organizations";

export const connectorOperationFeature = pgEnum("connector_operation_feature", [
	"ads_analysis",
	"ads_launch",
	"other",
]);

export const connectorOperationStatus = pgEnum("connector_operation_status", [
	"succeeded",
	"failed",
]);

export const connectorOperationEvents = pgTable(
	"connector_operation_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		connectorSlug: text("connector_slug").notNull(),
		toolName: text("tool_name").notNull(),
		feature: connectorOperationFeature("feature").notNull(),
		status: connectorOperationStatus("status").notNull(),
		errorCode: text("error_code"),
		errorMessage: text("error_message"),
		chatId: uuid("chat_id"),
		messageId: text("message_id"),
		durationMs: integer("duration_ms"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("connector_operation_events_connectorSlug_createdAt_idx").on(
			table.connectorSlug,
			table.createdAt,
		),
		index("connector_operation_events_feature_status_createdAt_idx").on(
			table.feature,
			table.status,
			table.createdAt,
		),
		index("connector_operation_events_userId_createdAt_idx").on(
			table.userId,
			table.createdAt,
		),
	],
);
