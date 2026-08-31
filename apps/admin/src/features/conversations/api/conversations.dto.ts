import type {
	AdminAiFailureSurface,
	AdminGenerationSurface,
} from "@wandit/contracts";

export type {
	AdminAiCall as AiCall,
	AdminAiFailure as AiFailure,
	AdminAiFailureSurface as AiFailureSurface,
	AdminAiFailuresResponse as AiFailuresResponse,
	AdminChatCallsResponse as ChatCallsResponse,
	AdminChatDetail as ChatDetail,
	AdminChatMessage as ChatMessage,
	AdminChatMessagesResponse as ChatMessagesResponse,
	AdminChatOwner as ChatOwner,
	AdminChatSummary as ChatSummary,
	AdminGenerationAttemptDetail as GenerationAttemptDetail,
	AdminGenerationSurface as GenerationSurface,
	AdminListProjectChatsResponse as ProjectChatsResponse,
	AdminListUserChatsResponse as UserChatsResponse,
} from "@wandit/contracts";

export type ConversationPageParams = {
	page?: number;
	pageSize?: number;
};

export type ListProjectChatsParams = ConversationPageParams & {
	projectId: string;
};

export type ListUserChatsParams = ConversationPageParams & {
	userId: string;
};

export type ListChatMessagesParams = ConversationPageParams & {
	chatId: string;
};

export type ListChatCallsParams = ConversationPageParams & {
	chatId: string;
};

export type ListAiFailuresParams = ConversationPageParams & {
	kind?: string;
	source?: string;
	provider?: string;
	surface?: AdminAiFailureSurface[];
	since?: string;
};

export type GetGenerationAttemptParams = {
	surface: AdminGenerationSurface;
	attemptId: string;
};
