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
import { z } from "zod";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { ChatService } from "../../../application/services/chat.service";
import { ChatStreamRelayService } from "../../../application/services/chat-stream-relay.service";

const redisStreamIdSchema = z.string().regex(/^\d+-\d+$/);

@Controller("v1/chats")
export class ChatsController {
	constructor(
		@Inject(ChatService)
		private readonly chatService: ChatService,
		@Inject(ChatStreamRelayService)
		private readonly chatStreamRelayService: ChatStreamRelayService,
	) {}

	@Get("by-project/:projectId")
	getByProject(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<ChatByProjectResponse> {
		return this.chatService.getByProject(user.id, projectId);
	}

	@Get(":chatId/messages")
	listMessages(
		@Param("chatId", new ZodValidationPipe(uuidSchema))
		chatId: string,
		@CurrentUser() user: AuthUser,
	): Promise<ChatMessagesResponse> {
		return this.chatService.listMessages(user.id, chatId);
	}

	@Post(":chatId/messages")
	sendMessage(
		@Param("chatId", new ZodValidationPipe(uuidSchema))
		chatId: string,
		@Body(new ZodValidationPipe(sendChatMessageBodySchema))
		body: SendChatMessageBody,
		@CurrentUser() user: AuthUser,
	): Promise<SendChatMessageResponse> {
		return this.chatService.sendMessage(user.id, chatId, body);
	}

	@Get(":chatId/stream")
	@SkipResponseEnvelope()
	async stream(
		@Param("chatId", new ZodValidationPipe(uuidSchema))
		chatId: string,
		@CurrentUser() user: AuthUser,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
		@Query("lastEventId") lastEventId?: string,
	): Promise<void> {
		const replayCursor = this.lastEventIdFromRequest(request, lastEventId);

		await this.chatService.assertStreamAccess(user.id, chatId);
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
		const header = request.headers["last-event-id"];

		if (typeof header === "string" && header.length > 0) {
			return this.parseLastEventId(header);
		}

		if (Array.isArray(header) && header.length > 0) {
			throw this.invalidLastEventId();
		}

		return queryLastEventId && queryLastEventId.length > 0
			? this.parseLastEventId(queryLastEventId)
			: undefined;
	}

	private parseLastEventId(value: string): string {
		const result = redisStreamIdSchema.safeParse(value);

		if (!result.success) {
			throw this.invalidLastEventId();
		}

		return result.data;
	}

	private invalidLastEventId() {
		return new BadRequestException({
			code: "INVALID_LAST_EVENT_ID",
			message: "Last-Event-ID must be a Redis stream id",
		});
	}
}
