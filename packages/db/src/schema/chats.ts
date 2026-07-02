import { relations } from "drizzle-orm";
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

export const messageRole = pgEnum("message_role", [
	"system",
	"user",
	"assistant",
]);

// One chat per project in MVP; the FK is intentionally non-unique so
// multiple chats per project need no migration later.
export const chats = pgTable(
	"chats",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("chats_projectId_idx").on(table.projectId)],
);

// Text id (not uuid): AI SDK v7 generates its own message ids client- and
// worker-side, and useChat reconciles by id on reload — we store them as-is.
export const messages = pgTable(
	"messages",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		chatId: uuid("chat_id")
			.notNull()
			.references(() => chats.id, { onDelete: "cascade" }),
		// Insertion-order tiebreaker: created_at is transaction time, so rows
		// written in the same transaction tie exactly.
		seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
		role: messageRole("role").notNull(),
		// AI SDK v7 UIMessage parts — flexible enough for future @-mentions.
		parts: jsonb("parts").notNull(),
		// AI SDK message metadata (model, usage…).
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("messages_chatId_seq_idx").on(table.chatId, table.seq)],
);

export const chatsRelations = relations(chats, ({ one, many }) => ({
	project: one(projects, {
		fields: [chats.projectId],
		references: [projects.id],
	}),
	messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	chat: one(chats, {
		fields: [messages.chatId],
		references: [chats.id],
	}),
}));
