import { useQuery } from "@tanstack/react-query";

import { chatKeys } from "@/features/workspace/api/chat.keys";
import {
	getChatByProject,
	getChatMessages,
} from "@/features/workspace/api/chat.requests";

/**
 * chat.queries.ts — read hooks for project chat id resolution and history.
 */

export function useChatByProject(projectId?: string) {
	return useQuery({
		queryKey: chatKeys.byProject(projectId ?? "none"),
		queryFn: () => getChatByProject(projectId as string),
		enabled: Boolean(projectId),
	});
}

export function useChatMessages(chatId?: string) {
	return useQuery({
		queryKey: chatKeys.messages(chatId ?? "none"),
		queryFn: () => getChatMessages(chatId as string),
		enabled: Boolean(chatId),
	});
}
