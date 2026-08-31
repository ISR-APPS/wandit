import {
	adminAiFailuresResponseSchema,
	adminChatCallsResponseSchema,
	adminChatDetailSchema,
	adminChatMessagesResponseSchema,
	adminGenerationAttemptDetailSchema,
	adminGenerationSurfaceSchema,
	adminListChatFailuresQuerySchema,
	adminListProjectChatsResponseSchema,
	adminListUserChatsResponseSchema,
	adminRoutes,
	paginationQuerySchema,
} from "@wandit/contracts";

import { apiGet } from "@/lib/api-client";

import type {
	AiFailuresResponse,
	ChatCallsResponse,
	ChatDetail,
	ChatMessagesResponse,
	GenerationAttemptDetail,
	GetGenerationAttemptParams,
	ListAiFailuresParams,
	ListChatCallsParams,
	ListChatMessagesParams,
	ListProjectChatsParams,
	ListUserChatsParams,
	ProjectChatsResponse,
	UserChatsResponse,
} from "./conversations.dto";

function pageQuery(input: { page?: number; pageSize?: number }) {
	return paginationQuerySchema.parse(input);
}

export async function listProjectChats({
	projectId,
	...params
}: ListProjectChatsParams): Promise<ProjectChatsResponse> {
	const query = pageQuery(params);
	const payload = await apiGet<unknown>(
		adminRoutes.projectChats(projectId),
		query,
	);

	return adminListProjectChatsResponseSchema.parse(payload);
}

export async function listUserChats({
	userId,
	...params
}: ListUserChatsParams): Promise<UserChatsResponse> {
	const query = pageQuery(params);
	const payload = await apiGet<unknown>(adminRoutes.userChats(userId), query);

	return adminListUserChatsResponseSchema.parse(payload);
}

export async function getChatDetail(chatId: string): Promise<ChatDetail> {
	const payload = await apiGet<unknown>(adminRoutes.chat(chatId));

	return adminChatDetailSchema.parse(payload);
}

export async function listChatMessages({
	chatId,
	...params
}: ListChatMessagesParams): Promise<ChatMessagesResponse> {
	const query = pageQuery(params);
	const payload = await apiGet<unknown>(
		adminRoutes.chatMessages(chatId),
		query,
	);

	return adminChatMessagesResponseSchema.parse(payload);
}

export async function listChatCalls({
	chatId,
	...params
}: ListChatCallsParams): Promise<ChatCallsResponse> {
	const query = pageQuery(params);
	const payload = await apiGet<unknown>(adminRoutes.chatCalls(chatId), query);

	return adminChatCallsResponseSchema.parse(payload);
}

export async function listAiFailures(
	params: ListAiFailuresParams,
): Promise<AiFailuresResponse> {
	const parsedQuery = adminListChatFailuresQuerySchema.parse({
		...params,
		surface: params.surface?.join(","),
	});
	const payload = await apiGet<unknown>(adminRoutes.aiFailures, {
		...parsedQuery,
		surface: parsedQuery.surface?.join(","),
	});

	return adminAiFailuresResponseSchema.parse(payload);
}

export async function getGenerationAttempt({
	surface,
	attemptId,
}: GetGenerationAttemptParams): Promise<GenerationAttemptDetail> {
	const parsedSurface = adminGenerationSurfaceSchema.parse(surface);
	const payload = await apiGet<unknown>(
		adminRoutes.generationAttempt(parsedSurface, attemptId),
	);

	return adminGenerationAttemptDetailSchema.parse(payload);
}
