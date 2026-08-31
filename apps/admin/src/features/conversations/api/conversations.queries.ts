import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type {
	GetGenerationAttemptParams,
	ListAiFailuresParams,
	ListChatCallsParams,
	ListChatMessagesParams,
	ListProjectChatsParams,
	ListUserChatsParams,
} from "./conversations.dto";
import {
	getChatDetail,
	getGenerationAttempt,
	listAiFailures,
	listChatCalls,
	listChatMessages,
	listProjectChats,
	listUserChats,
} from "./conversations.services";

function pageDimensions(params: { page?: number; pageSize?: number }) {
	return [params.page ?? 1, params.pageSize ?? 20] as const;
}

export const adminConversationKeys = {
	all: ["admin-conversations"] as const,
	chats: () => [...adminConversationKeys.all, "chats"] as const,
	projectChats: (params: ListProjectChatsParams) =>
		[
			...adminConversationKeys.chats(),
			"project",
			params.projectId,
			...pageDimensions(params),
		] as const,
	userChats: (params: ListUserChatsParams) =>
		[
			...adminConversationKeys.chats(),
			"user",
			params.userId,
			...pageDimensions(params),
		] as const,
	chat: (chatId: string) => [...adminConversationKeys.chats(), chatId] as const,
	messages: (params: ListChatMessagesParams) =>
		[
			...adminConversationKeys.chat(params.chatId),
			"messages",
			...pageDimensions(params),
		] as const,
	calls: (params: ListChatCallsParams) =>
		[
			...adminConversationKeys.chat(params.chatId),
			"calls",
			...pageDimensions(params),
		] as const,
	failures: (params: ListAiFailuresParams) =>
		[
			...adminConversationKeys.all,
			"failures",
			...pageDimensions(params),
			params.kind ?? null,
			params.source ?? null,
			params.provider ?? null,
			params.surface?.join(",") ?? null,
			params.since ?? null,
		] as const,
	generation: ({ surface, attemptId }: GetGenerationAttemptParams) =>
		[...adminConversationKeys.all, "generation", surface, attemptId] as const,
};

export function useProjectChatsQuery(params: ListProjectChatsParams) {
	return useQuery({
		queryKey: adminConversationKeys.projectChats(params),
		queryFn: () => listProjectChats(params),
		placeholderData: keepPreviousData,
	});
}

export function useUserChatsQuery(params: ListUserChatsParams) {
	return useQuery({
		queryKey: adminConversationKeys.userChats(params),
		queryFn: () => listUserChats(params),
		placeholderData: keepPreviousData,
	});
}

export function useChatDetailQuery(chatId: string | undefined) {
	return useQuery({
		queryKey: adminConversationKeys.chat(chatId ?? "none"),
		queryFn: () => getChatDetail(chatId as string),
		enabled: Boolean(chatId),
	});
}

export function useChatMessagesQuery(params: ListChatMessagesParams) {
	return useQuery({
		queryKey: adminConversationKeys.messages(params),
		queryFn: () => listChatMessages(params),
		placeholderData: keepPreviousData,
	});
}

export function useChatCallsQuery(params: ListChatCallsParams) {
	return useQuery({
		queryKey: adminConversationKeys.calls(params),
		queryFn: () => listChatCalls(params),
		placeholderData: keepPreviousData,
	});
}

export function useAiFailuresQuery(params: ListAiFailuresParams) {
	return useQuery({
		queryKey: adminConversationKeys.failures(params),
		queryFn: () => listAiFailures(params),
		placeholderData: keepPreviousData,
	});
}

export function useGenerationAttemptQuery(
	params: GetGenerationAttemptParams,
	{ enabled }: { enabled: boolean },
) {
	return useQuery({
		queryKey: adminConversationKeys.generation(params),
		queryFn: () => getGenerationAttempt(params),
		enabled,
	});
}
