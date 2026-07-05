import type { ChatMessage, MessagePart } from "@wandit/contracts";
import type { messages } from "@wandit/db/schema/chats";

export type MessageRow = typeof messages.$inferSelect;

export function mapMessageRow(row: MessageRow): ChatMessage {
	return {
		chatId: row.chatId,
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		metadata: isRecord(row.metadata) ? row.metadata : null,
		parts: Array.isArray(row.parts) ? (row.parts as MessagePart[]) : [],
		role: row.role,
		seq: row.seq,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
