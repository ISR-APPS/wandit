/**
 * Shared contract for the paged chat history of a V2 project (WANDIT-204).
 * The API reads `messages` by `seq`, the newest page first. The web loads
 * the newest page when the chat opens and older pages on demand.
 */
import { z } from "zod";
import { chatMessageSchema } from "../v1/chats";

/**
 * Query of `GET /api/v2/projects/:projectId/messages`. `cursor` is the
 * `nextCursor` of the newer page. No cursor reads the newest page.
 */
export const chatHistoryQuerySchema = z.object({
	// A message `seq`. At most 15 digits stay below Number.MAX_SAFE_INTEGER,
	// so the number parse never rounds the cursor.
	cursor: z
		.string()
		.regex(/^[1-9][0-9]{0,14}$/, "expected the nextCursor of a page")
		.transform(Number)
		.optional(),
	// Query params arrive as strings, so the number needs coercion. 30 rows
	// fill the open chat. An assistant row holds 44–80 KB of parts, so 50
	// rows cap one answer.
	limit: z.coerce.number().int().min(1).max(50).default(30),
});

/** Parsed query of the history route: `cursor` is a number after the parse. */
export type ChatHistoryQuery = z.infer<typeof chatHistoryQuerySchema>;

/**
 * Answer of the history route. `items` hold one page in chat order, the
 * oldest message first. `nextCursor` reads the next older page; null on
 * the oldest page.
 */
export const chatHistoryPageSchema = z.object({
	items: z.array(chatMessageSchema),
	nextCursor: z.string().nullable(),
});

/** One page of the history route. */
export type ChatHistoryPage = z.infer<typeof chatHistoryPageSchema>;
