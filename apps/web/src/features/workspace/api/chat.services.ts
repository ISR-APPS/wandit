// Raw async functions for the real chat entity — NO React in here. Thin fetch
// wrappers over the shared api-client; responses parsed with @wandit/contracts.
// The SSE stream (chatsRoutes.stream) is consumed directly via EventSource in
// lib/use-project-chat.tsx, not here (it bypasses the JSON envelope).

import {
	chatByProjectResponseSchema,
	chatMessagesResponseSchema,
	chatsRoutes,
	type SendChatMessageBody,
	sendChatMessageResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

export async function getChatByProject(projectId: string) {
	const data = await apiClient.get<unknown>(chatsRoutes.byProject(projectId));
	return chatByProjectResponseSchema.parse(data);
}

export async function getChatMessages(chatId: string) {
	const data = await apiClient.get<unknown>(chatsRoutes.messages(chatId));
	return chatMessagesResponseSchema.parse(data);
}

export async function sendChatMessage(
	chatId: string,
	body: SendChatMessageBody,
) {
	const data = await apiClient.post<unknown>(
		chatsRoutes.messages(chatId),
		body,
	);
	return sendChatMessageResponseSchema.parse(data);
}
