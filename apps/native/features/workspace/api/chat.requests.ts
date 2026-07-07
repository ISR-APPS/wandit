import {
	type ChatByProjectResponse,
	type ChatMessagesResponse,
	type SendChatMessageResponse,
	chatByProjectResponseSchema,
	chatMessagesResponseSchema,
	chatsRoutes,
	sendChatMessageBodySchema,
	sendChatMessageResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/shared/lib/api-client";

/**
 * chat.requests.ts — raw JSON calls for the chat API.
 *
 * The stream endpoint is intentionally absent here: it is not JSON/axios and is
 * consumed by the RN SSE transport in ../lib/chat-stream.ts.
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

// POST /api/v1/chats/:chatId/messages
export async function sendChatMessage(
	chatId: string,
	input: { text: string },
): Promise<SendChatMessageResponse> {
	const body = sendChatMessageBodySchema.parse({ text: input.text });
	const data = await apiClient.post<SendChatMessageResponse, typeof body>(
		chatsRoutes.messages(chatId),
		body,
	);
	return sendChatMessageResponseSchema.parse(data);
}
