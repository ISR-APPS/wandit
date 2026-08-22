/**
 * chat.services.ts — the "service layer" of the chat feature on the web side.
 *
 * WHAT THIS FILE IS
 * Three plain async functions that talk to the chat REST endpoints on the
 * NestJS API server. This is the lowest layer of the frontend's chat stack:
 * it knows how to make HTTP calls and validate the responses, and nothing
 * else. There are no React hooks, no caching, no UI concerns here.
 *
 * WHERE IT SITS IN THE END-TO-END FLOW
 * 1. Chat UI components (features/workspace/components/chat/*) render the
 *    conversation and the composer box.
 * 2. chat.queries.ts wraps getChatByProject / getChatMessages in TanStack
 *    Query hooks (caching + refetching), and lib/use-project-chat.tsx calls
 *    sendChatMessage when the user hits send.
 * 3. These functions hit the NestJS chats controller
 *    (apps/server/.../chats.controller.ts), which persists the message and
 *    enqueues a background AI-generation job (BullMQ + the worker app).
 * 4. The assistant's actual reply does NOT come back through this file — it
 *    streams over a separate SSE (Server-Sent Events) connection, consumed
 *    by an EventSource in lib/use-project-chat.tsx. This file only covers
 *    the plain request/response JSON endpoints.
 *
 * SHARED PATTERN IN ALL THREE FUNCTIONS
 * - URLs come from chatsRoutes (a route map in @wandit/contracts), so the
 *   frontend and backend can never drift on paths.
 * - Responses are fetched as `unknown` and then run through a Zod schema's
 *   .parse(). Zod is a runtime validation library: unlike TypeScript types
 *   (which vanish at runtime), .parse() actually checks the JSON at runtime
 *   and THROWS if the server's shape doesn't match. That means a bad/changed
 *   API response fails loudly right here instead of causing weird undefined
 *   errors deeper in the UI.
 */
// Raw async functions for the real chat entity — NO React in here. Thin fetch
// wrappers over the shared api-client; responses parsed with @wandit/contracts.
// The SSE stream (chatsRoutes.stream) is consumed directly via EventSource in
// lib/use-project-chat.tsx, not here (it bypasses the JSON envelope).

// @wandit/contracts is the shared package where frontend and backend agree on
// API shapes. It exports Zod schemas (runtime validators that double as the
// source of TypeScript types) plus chatsRoutes, a tiny map of URL-builder
// functions (e.g. chatsRoutes.messages(id) -> "/api/v1/chats/<id>/messages").
import {
	chatByProjectResponseSchema,
	chatMessagesResponseSchema,
	chatsRoutes,
	type SendChatMessageBody,
	sendChatMessageResponseSchema,
} from "@wandit/contracts";

// apiClient is the app-wide HTTP client (an axios wrapper). It already knows
// the API base URL, sends the auth cookies, and unwraps the server's
// { data, meta } response envelope — so the functions below receive just the
// inner `data` payload, not the whole envelope.
import { apiClient } from "@/lib/api-client";

/**
 * Look up the chat that belongs to a project. Every project has exactly one
 * chat, so the UI first calls this with the projectId it already knows to
 * translate it into a chatId — which every other chat endpoint needs.
 * Returns { chatId, projectId }.
 */
export async function getChatByProject(projectId: string) {
	// The <unknown> type argument is deliberate: we refuse to *assume* what the
	// server sent back. The Zod .parse() on the next line is what proves the
	// shape at runtime and gives us a properly typed value (or throws).
	const data = await apiClient.get<unknown>(chatsRoutes.byProject(projectId));
	return chatByProjectResponseSchema.parse(data);
}

/**
 * Fetch the full message history of a chat, oldest to newest. Returns
 * { generationActive, messages }: `generationActive` tells the UI whether an
 * AI reply is still being generated right now (so a page refresh mid-stream
 * can show a "thinking" state and reattach to the SSE stream instead of
 * looking frozen). Used by useChatMessagesQuery in chat.queries.ts.
 * NOTE: this returns the ENTIRE history in one response — no pagination —
 * which is fine for now but will get heavy for very long chats.
 */
export async function getChatMessages(chatId: string) {
	const data = await apiClient.get<unknown>(chatsRoutes.messages(chatId));
	return chatMessagesResponseSchema.parse(data);
}

/**
 * Send the user's message to a chat. The body is { text, composer? } where
 * `composer` carries the composer chips' settings (mode like "page" or
 * "marketing", output options, etc.).
 *
 * IMPORTANT MENTAL MODEL: this is fire-and-acknowledge, not request/reply.
 * The server saves the user message, enqueues a background AI job, and
 * immediately answers with just { messageId, jobId } — the assistant's actual
 * reply is NOT in this response. It arrives later, token by token, over the
 * SSE stream that use-project-chat.tsx listens to. So don't expect to await
 * this call and get an answer back.
 */
export async function sendChatMessage(
	chatId: string,
	body: SendChatMessageBody,
) {
	// POST to the same /messages URL that GET reads from — REST convention:
	// GET lists the collection, POST appends to it.
	const data = await apiClient.post<unknown>(
		chatsRoutes.messages(chatId),
		body,
	);
	return sendChatMessageResponseSchema.parse(data);
}
