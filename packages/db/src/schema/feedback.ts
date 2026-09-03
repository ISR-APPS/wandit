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

export const feedbackCategory = pgEnum("feedback_category", [
	"bug",
	"idea",
	"other",
]);

export const feedbackStatus = pgEnum("feedback_status", [
	"new",
	"reviewing",
	"planned",
	"resolved",
]);

export const feedbackPriority = pgEnum("feedback_priority", [
	"urgent",
	"high",
	"medium",
	"low",
]);

export const feedbackActivityKind = pgEnum("feedback_activity_kind", [
	"received",
	"status_changed",
	"priority_changed",
	"note_updated",
]);

export const feedback = pgTable(
	"feedback",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Reporter. The FK clears on account deletion; the name/email snapshot
		// keeps the row readable in the admin panel afterwards.
		userId: text("user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		reporterName: text("reporter_name").notNull(),
		reporterEmail: text("reporter_email").notNull(),
		// Parsed from pageUrl (`/p/{uuid}` is the workspace route). No FK on
		// purpose: the value only resolves a project name at read time and must
		// never make an insert fail.
		projectId: uuid("project_id"),
		// The workspace chat the user had open, when known. No FK on purpose:
		// telemetry context must never make the feedback insert fail.
		chatId: uuid("chat_id"),
		// Better Auth session record id (session.id, never session.token), captured
		// server-side. No FK: session deletion must not erase attribution.
		authSessionId: text("auth_session_id"),
		category: feedbackCategory("category"),
		message: text("message").notNull(),
		pageUrl: text("page_url").notNull(),
		replayUrl: text("replay_url"),
		sentryEventId: text("sentry_event_id"),
		sentryEventAt: timestamp("sentry_event_at", { withTimezone: true }),
		userAgent: text("user_agent"),
		viewportWidth: integer("viewport_width"),
		viewportHeight: integer("viewport_height"),
		locale: text("locale"),
		// Public R2 URL.
		screenshotUrl: text("screenshot_url"),
		// Linear identifier, for example "ISRECOM-123".
		linearIssueId: text("linear_issue_id"),
		linearIssueUrl: text("linear_issue_url"),
		status: feedbackStatus("status").default("new").notNull(),
		priority: feedbackPriority("priority").default("medium").notNull(),
		adminNote: text("admin_note").default("").notNull(),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("feedback_status_createdAt_idx").on(table.status, table.createdAt),
		index("feedback_createdAt_idx").on(table.createdAt),
		index("feedback_userId_idx").on(table.userId),
	],
);

export const feedbackActivities = pgTable(
	"feedback_activities",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		feedbackId: uuid("feedback_id")
			.notNull()
			.references(() => feedback.id, { onDelete: "cascade" }),
		kind: feedbackActivityKind("kind").notNull(),
		fromValue: text("from_value"),
		toValue: text("to_value"),
		// Null for the reporter entry and deleted staff accounts.
		actorUserId: text("actor_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("feedback_activities_feedbackId_createdAt_idx").on(
			table.feedbackId,
			table.createdAt,
		),
	],
);
