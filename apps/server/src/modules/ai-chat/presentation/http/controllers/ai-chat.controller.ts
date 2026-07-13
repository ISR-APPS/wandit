import {
	BadRequestException,
	Body,
	Controller,
	Inject,
	NotFoundException,
	Param,
	Post,
	Req,
	Res,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { uuidSchema } from "@wandit/contracts";
import { validateUIMessages } from "ai";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { ChatsRepository } from "../../../../generation/infrastructure/persistence/chats.repository";
import {
	aiChatToolsForValidation,
	type WanditUIMessage,
} from "../../../agent/chat-agent";
import { AiChatService } from "../../../application/services/ai-chat.service";

const aiChatRequestBodySchema = z.object({
	id: z.string().min(1).optional(),
	messageId: z.string().min(1).optional(),
	messages: z.array(z.unknown()),
	trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
});

type AiChatRequestBody = z.infer<typeof aiChatRequestBodySchema>;

@Controller("v1/chats")
export class AiChatController {
	constructor(
		@Inject(AiChatService)
		private readonly aiChatService: AiChatService,
		@Inject(ChatsRepository)
		private readonly chatsRepository: ChatsRepository,
	) {}

	@Post(":chatId/ai-stream")
	@SkipResponseEnvelope()
	async stream(
		@Param("chatId", new ZodValidationPipe(uuidSchema))
		chatId: string,
		@Body(new ZodValidationPipe(aiChatRequestBodySchema))
		body: AiChatRequestBody,
		@CurrentUser() user: AuthUser,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const chat = await this.chatsRepository.findOwnedChatById(user.id, chatId);

		if (!chat) {
			throw new NotFoundException();
		}

		if (hasSystemMessage(body.messages)) {
			throw new BadRequestException({
				code: "SYSTEM_MESSAGES_NOT_ALLOWED",
				message: "System messages must be configured on the server",
			});
		}

		const messages = await this.validateMessages(body.messages);
		const abortController = new AbortController();

		request.raw.once("close", () => abortController.abort());

		// The AI SDK owns this raw SSE response and its UI-message protocol.
		reply.hijack();
		this.aiChatService.stream({
			abortSignal: abortController.signal,
			chatId: chat.id,
			messages,
			origin: request.headers.origin,
			// The generate_page tool acts on the chat's project; the ownership
			// query above already proved this user owns it.
			projectId: chat.projectId,
			reply,
		});
	}

	private async validateMessages(
		messages: unknown[],
	): Promise<WanditUIMessage[]> {
		// Historical failed streams could persist empty assistant messages. They carry
		// no transcript information, so discard them here as a defensive safeguard.
		const nonEmptyMessages = messages.filter(
			(message) => !hasEmptyParts(message),
		);

		try {
			return await validateUIMessages<WanditUIMessage>({
				messages: nonEmptyMessages,
				tools: aiChatToolsForValidation,
			});
		} catch {
			throw new BadRequestException({
				code: "INVALID_UI_MESSAGES",
				message: "Messages do not match the AI chat protocol",
			});
		}
	}
}

function hasEmptyParts(message: unknown): boolean {
	return (
		typeof message === "object" &&
		message !== null &&
		"parts" in message &&
		Array.isArray(message.parts) &&
		message.parts.length === 0
	);
}

function hasSystemMessage(messages: readonly unknown[]): boolean {
	return messages.some(
		(message) =>
			typeof message === "object" &&
			message !== null &&
			"role" in message &&
			message.role === "system",
	);
}
