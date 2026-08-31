import { Controller, Get, Inject, Param, Query, Req } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminAiFailuresResponse,
	type AdminChatCallsResponse,
	type AdminChatDetail,
	type AdminChatMessagesResponse,
	type AdminGenerationAttemptDetail,
	type AdminGenerationSurface,
	type AdminListChatFailuresQuery,
	type AdminListProjectChatsResponse,
	type AdminListUserChatsResponse,
	adminGenerationSurfaceSchema,
	adminListChatFailuresQuerySchema,
	adminRoutes,
	type PaginationQuery,
	paginationQuerySchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { AdminConversationsService } from "../../../application/services/admin-conversations.service";
import { AdminOnly } from "../decorators/admin-only.decorator";
import { AdminPermission } from "../decorators/admin-permission.decorator";

const API_PREFIX = "/api/";

function withoutGlobalApiPrefix(route: string): string {
	return route.startsWith(API_PREFIX) ? route.slice(API_PREFIX.length) : route;
}

const ADMIN_CONVERSATIONS_CONTROLLER_PATH = withoutGlobalApiPrefix(
	adminRoutes.aiFailures,
).replace(/\/ai-failures$/u, "");

function adminConversationChildPath(route: string): string {
	return withoutGlobalApiPrefix(route).slice(
		ADMIN_CONVERSATIONS_CONTROLLER_PATH.length + 1,
	);
}

@Controller(ADMIN_CONVERSATIONS_CONTROLLER_PATH)
@AdminOnly()
@AdminPermission({ conversations: ["read"] })
export class AdminConversationsController {
	constructor(
		@Inject(AdminConversationsService)
		private readonly adminConversationsService: AdminConversationsService,
	) {}

	@Get(adminConversationChildPath(adminRoutes.projectChats(":projectId")))
	listProjectChats(
		@Param("projectId", new ZodValidationPipe(uuidSchema)) projectId: string,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
	): Promise<AdminListProjectChatsResponse> {
		return this.adminConversationsService.listProjectChats(projectId, query);
	}

	@Get(adminConversationChildPath(adminRoutes.userChats(":userId")))
	listUserChats(
		@Param("userId") userId: string,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
	): Promise<AdminListUserChatsResponse> {
		return this.adminConversationsService.listUserChats(userId, query);
	}

	@Get(adminConversationChildPath(adminRoutes.chat(":chatId")))
	getChatDetail(
		@Param("chatId", new ZodValidationPipe(uuidSchema)) chatId: string,
	): Promise<AdminChatDetail> {
		return this.adminConversationsService.getChatDetail(chatId);
	}

	@Get(adminConversationChildPath(adminRoutes.chatMessages(":chatId")))
	listChatMessages(
		@Param("chatId", new ZodValidationPipe(uuidSchema)) chatId: string,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
		@CurrentUser() admin: AuthUser,
		@Req() request: FastifyRequest,
	): Promise<AdminChatMessagesResponse> {
		return this.adminConversationsService.listChatMessages(chatId, query, {
			admin: { id: admin.id, role: admin.role },
			requestId: request.id,
		});
	}

	@Get(adminConversationChildPath(adminRoutes.chatCalls(":chatId")))
	listChatCalls(
		@Param("chatId", new ZodValidationPipe(uuidSchema)) chatId: string,
		@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery,
	): Promise<AdminChatCallsResponse> {
		return this.adminConversationsService.listChatCalls(chatId, query);
	}

	@Get(adminConversationChildPath(adminRoutes.aiFailures))
	listAiFailures(
		@Query(new ZodValidationPipe(adminListChatFailuresQuerySchema))
		query: AdminListChatFailuresQuery,
	): Promise<AdminAiFailuresResponse> {
		return this.adminConversationsService.listAiFailures(query);
	}

	@Get(
		adminConversationChildPath(
			adminRoutes.generationAttempt(":surface", ":attemptId"),
		),
	)
	getGenerationAttempt(
		@Param("surface", new ZodValidationPipe(adminGenerationSurfaceSchema))
		surface: AdminGenerationSurface,
		@Param("attemptId") attemptId: string,
	): Promise<AdminGenerationAttemptDetail> {
		return this.adminConversationsService.getGenerationAttempt(
			surface,
			attemptId,
		);
	}
}
