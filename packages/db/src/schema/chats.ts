// Database schema for chat conversations.
//
// Drizzle describes Postgres tables in TypeScript. API and worker repositories
// use these table definitions for typed queries.
//
// Important: messages store AI SDK "parts" as JSONB, not just one text column.
import { relations, sql } from "drizzle-orm";
import {
	bigint,
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

// Postgres enum for who wrote a message.
export const messageRole = pgEnum("message_role", [
	"system",
	"user",
	"assistant",
]);

// One chat conversation attached to a project.
// MVP uses one chat per project, but the schema allows more later.
export const chats = pgTable(
	"chats",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Chat belongs to a project.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Timestamps for chat container.
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// Speeds up "find chat by project id".
		index("chats_projectId_idx").on(table.projectId),
		index("chats_projectId_updatedAt_idx").on(table.projectId, table.updatedAt),
	],
);

// Saved chat messages: user prompts and final assistant replies.
// Live streaming deltas are not saved here; they go through Redis/SSE.
export const messages = pgTable(
	"messages",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		// Message belongs to a chat.
		chatId: uuid("chat_id")
			.notNull()
			.references(() => chats.id, { onDelete: "cascade" }),
		// Server-side insertion order.
		seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
		role: messageRole("role").notNull(),
		// AI SDK UIMessage parts stored as JSON.
		parts: jsonb("parts").notNull(),
		// Extra metadata like model/usage.
		metadata: jsonb("metadata"),
		failureKind: text("failure_kind"),
		failureSource: text("failure_source"),
		failureProvider: text("failure_provider"),
		failureProviderMessage: text("failure_provider_message"),
		failureRequestId: text("failure_request_id"),
		sentryEventId: text("sentry_event_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// Speeds up loading messages for one chat in order.
		index("messages_chatId_seq_idx").on(table.chatId, table.seq),
		index("messages_failureKind_createdAt_idx")
			.on(table.failureKind, table.createdAt)
			.where(sql`${table.failureKind} IS NOT NULL`),
	],
);

// Relations tell Drizzle how tables connect.
export const chatsRelations = relations(chats, ({ one, many }) => ({
	project: one(projects, {
		fields: [chats.projectId],
		references: [projects.id],
	}),
	messages: many(messages),
}));

// One message belongs to one chat.
export const messagesRelations = relations(messages, ({ one }) => ({
	chat: one(chats, {
		fields: [messages.chatId],
		references: [chats.id],
	}),
}));
