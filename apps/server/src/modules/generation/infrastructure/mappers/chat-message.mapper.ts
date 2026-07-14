/**
 * Converts a database message row into the API message shape.
 *
 * Database rows contain Date objects and raw JSON. API responses need strings
 * and safe JSON shapes.
 */
import type { ChatMessage, MessagePart } from "@wandit/contracts";
// Drizzle can infer the TypeScript row type from the table schema.
import type { messages } from "@wandit/db/schema/chats";

// Type of one row from the messages table.
export type MessageRow = typeof messages.$inferSelect;

// Convert one DB row to one API message.
export function mapMessageRow(row: MessageRow): ChatMessage {
	return {
		chatId: row.chatId,
		// Send dates as strings over JSON.
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		// metadata must be an object or null.
		metadata: isRecord(row.metadata) ? row.metadata : null,
		// parts should be an array. Use [] if the JSON is not what we expected.
		parts: Array.isArray(row.parts) ? (row.parts as MessagePart[]) : [],
		role: row.role,
		seq: row.seq,
	};
}

// Runtime check for "plain object, not null, not array".
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
