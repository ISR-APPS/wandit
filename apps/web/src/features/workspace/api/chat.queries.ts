// TanStack Query queries + keys for the real chat: resolve the chat id from a
// project, then load its message history. The SSE stream (use-project-chat.tsx)
// patches and invalidates the messages cache under these same keys.

import { useQuery } from "@tanstack/react-query";

import { getChatByProject, getChatMessages } from "./chat.services";

export const chatKeys = {
	all: ["chat"] as const,
	byProject: (projectId: string) =>
		[...chatKeys.all, "by-project", projectId] as const,
	messages: (chatId: string) => [...chatKeys.all, "messages", chatId] as const,
};

export function useChatByProjectQuery(projectId: string) {
	return useQuery({
		queryKey: chatKeys.byProject(projectId),
		queryFn: () => getChatByProject(projectId),
	});
}

export function useChatMessagesQuery(chatId: string | undefined) {
	return useQuery({
		queryKey: chatKeys.messages(chatId ?? "none"),
		queryFn: () => getChatMessages(chatId as string),
		enabled: Boolean(chatId),
	});
}
