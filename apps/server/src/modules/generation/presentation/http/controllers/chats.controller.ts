/**
 * HTTP routes for chat.
 *
 * Express version: `router.get(...)`, `router.post(...)`.
 * Nest version: a controller class with decorators like `@Get()` and `@Post()`.
 *
 * This controller should stay thin. It validates request data and calls services.
 */
// Decorators tell Nest which URL/method each class method handles.
import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	Query,
	Req,
	Res,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type ChatByProjectResponse,
	type ChatMessagesResponse,
	type SendChatMessageBody,
	type SendChatMessageResponse,
	sendChatMessageBodySchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
// Zod validates real request data at runtime.
import { z } from "zod";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	PersonalWorkspaceOnly,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { ChatService } from "../../../application/services/chat.service";
import { ChatStreamRelayService } from "../../../application/services/chat-stream-relay.service";

// Redis stream ids look like "171000-0".
const redisStreamIdSchema = z.string().regex(/^\d+-\d+$/);

// main.ts adds `/api`, so this becomes `/api/v1/chats`.
@Controller("v1/chats")
export class ChatsController {
	constructor(
		// Nest injects these services. We do not call `new ChatService()` manually.
		@Inject(ChatService)
		private readonly chatService: ChatService,
		@Inject(ChatStreamRelayService)
		private readonly chatStreamRelayService: ChatStreamRelayService,
	) {}

	// Convert projectId to chatId.
	@Get("by-project/:projectId")
	getByProject(
		// Validate the path param as a UUID before the method runs.
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		// `@CurrentUser()` reads the logged-in user from the request.
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ChatByProjectResponse> {
		return this.chatService.getByProject(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	// Load saved messages and current busy state.
	@Get(":chatId/messages")
	listMessages(
		@Param("chatId", new ZodValidationPipe(uuidSchema))
		chatId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ChatMessagesResponse> {
		return this.chatService.listMessages(
			projectScopeFrom(workspace, user.id),
			chatId,
		);
	}

	// Save the user's prompt and enqueue generation. The answer streams later.
	// Legacy BullMQ path: personal workspaces only (teams-workspaces.md §0).
	@PersonalWorkspaceOnly()
	@Post(":chatId/messages")
	sendMessage(
		@Param("chatId", new ZodValidationPipe(uuidSchema))
		chatId: string,
		// Validate the JSON body with the shared contract schema.
		@Body(new ZodValidationPipe(sendChatMessageBodySchema))
		body: SendChatMessageBody,
		@CurrentUser() user: AuthUser,
	): Promise<SendChatMessageResponse> {
		return this.chatService.sendMessage(user.id, chatId, body);
	}

	// Open the SSE stream used for live assistant text.
	// Legacy relay path: personal workspaces only (teams-workspaces.md §0).
	@PersonalWorkspaceOnly()
	@Get(":chatId/stream")
	// Do not wrap this response as JSON; SSE must be raw text.
	@SkipResponseEnvelope()
	async stream(
		@Param("chatId", new ZodValidationPipe(uuidSchema))
		chatId: string,
		@CurrentUser() user: AuthUser,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
		@Query("lastEventId") lastEventId?: string,
	): Promise<void> {
		// Browser reconnects may include Last-Event-ID so we can replay missed events.
		const replayCursor = this.lastEventIdFromRequest(request, lastEventId);

		// Check ownership before opening a long-lived stream.
		await this.chatService.assertStreamAccess(user.id, chatId);
		// The relay now writes directly to the Fastify response.
		await this.chatStreamRelayService.relay({
			chatId,
			lastEventId: replayCursor,
			reply,
			request,
		});
	}

	private lastEventIdFromRequest(
		request: FastifyRequest,
		queryLastEventId?: string,
	): string | undefined {
		// Prefer the standard EventSource header.
		const header = request.headers["last-event-id"];

		if (typeof header === "string" && header.length > 0) {
			return this.parseLastEventId(header);
		}

		// Multiple cursor headers are ambiguous.
		if (Array.isArray(header) && header.length > 0) {
			throw this.invalidLastEventId();
		}

		// If there is no header, use the optional query fallback.
		return queryLastEventId && queryLastEventId.length > 0
			? this.parseLastEventId(queryLastEventId)
			: undefined;
	}

	// Validate the reconnect cursor.
	private parseLastEventId(value: string): string {
		const result = redisStreamIdSchema.safeParse(value);

		if (!result.success) {
			throw this.invalidLastEventId();
		}

		return result.data;
	}

	// Same error for invalid header or query cursor.
	private invalidLastEventId() {
		return new BadRequestException({
			code: "INVALID_LAST_EVENT_ID",
			message: "Last-Event-ID must be a Redis stream id",
		});
	}
}
