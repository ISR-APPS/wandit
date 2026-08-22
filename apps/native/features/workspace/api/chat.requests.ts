import {
	type ChatByProjectResponse,
	type ChatMessagesResponse,
	chatByProjectResponseSchema,
	chatMessagesResponseSchema,
	chatsRoutes,
} from "@wandit/contracts";

import { apiClient } from "@/shared/lib/api-client";

/**
 * chat.requests.ts — raw JSON calls for the chat API.
 *
 * Streaming deliberately lives in use-ai-chat.ts because the response is an
 * AI SDK event stream rather than a JSON envelope.
 */

// GET /api/v1/chats/by-project/:projectId
export async function getChatByProject(
	projectId: string,
): Promise<ChatByProjectResponse> {
	const data = await apiClient.get<ChatByProjectResponse>(
		chatsRoutes.byProject(projectId),
	);
	return chatByProjectResponseSchema.parse(data);
}

// GET /api/v1/chats/:chatId/messages
export async function getChatMessages(
	chatId: string,
): Promise<ChatMessagesResponse> {
	const data = await apiClient.get<ChatMessagesResponse>(
		chatsRoutes.messages(chatId),
	);
	return chatMessagesResponseSchema.parse(data);
}
