/**
 * Converts a database message row into the API message shape.
 *
 * Database rows contain Date objects and raw JSON. API responses need strings
 * and safe JSON shapes.
 */
import { type ChatMessage, messagePartsSchema } from "@wandit/contracts";
// Drizzle can infer the TypeScript row type from the table schema.
import type { messages } from "@wandit/db/schema/chats";
import {
	publicAiMetadata,
	publicAiPart,
} from "../../../../infrastructure/http/public-ai-response";

// Type of one row from the messages table.
export type MessageRow = typeof messages.$inferSelect;

/** Removes internal model details from stored V1 and V2 messages before the browser receives them. */
export function mapMessageRow(row: MessageRow): ChatMessage {
	const parts = messagePartsSchema.safeParse(row.parts);
	return {
		chatId: row.chatId,
		// Send dates as strings over JSON.
		createdAt: row.createdAt.toISOString(),
		id: row.id,
		metadata: publicAiMetadata(row.metadata),
		// Invalid historical part containers keep the previous empty-message fallback.
		parts: parts.success ? parts.data.map((part) => publicAiPart(part)) : [],
		role: row.role,
		seq: row.seq,
	};
}
