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
import {
	composerMetadataSchema,
	uuidSchema,
	widSchema,
} from "@wandit/contracts";
import { validateUIMessages } from "ai";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { isWanditHostedUrl } from "../../../../../infrastructure/storage/r2";
import { CurrentUser } from "../../../../auth";
import { ChatsRepository } from "../../../../generation/infrastructure/persistence/chats.repository";
import {
	aiChatToolsForValidation,
	type WanditUIMessage,
} from "../../../agent/chat-agent";
import { AiChatService } from "../../../application/services/ai-chat.service";

// Per-request app metadata (contract §10.1): the prompt-box settings and the
// preview selection. Exported so the service and request-context module can
// import the type (type-only — no runtime cycle).
export const aiChatRequestMetadataSchema = z.object({
	composer: composerMetadataSchema.optional(),
	selectedWid: widSchema.optional(),
});

export type AiChatRequestMetadata = z.infer<typeof aiChatRequestMetadataSchema>;

const aiChatRequestBodySchema = z.object({
	id: z.string().min(1).optional(),
	messageId: z.string().min(1).optional(),
	messages: z.array(z.unknown()),
	metadata: aiChatRequestMetadataSchema.optional(),
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
		await this.aiChatService.stream({
			abortSignal: abortController.signal,
			chatId: chat.id,
			messages,
			metadata: body.metadata,
			origin: request.headers.origin,
			// The generate_page and page-edit tools act on the chat's project;
			// the ownership query above already proved this user owns it.
			projectId: chat.projectId,
			reply,
			requestCountryCode: readRequestCountryCode(request.headers),
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

		let validated: WanditUIMessage[];

		try {
			validated = await validateUIMessages<WanditUIMessage>({
				messages: nonEmptyMessages,
				tools: aiChatToolsForValidation,
			});
		} catch {
			throw new BadRequestException({
				code: "INVALID_UI_MESSAGES",
				message: "Messages do not match the AI chat protocol",
			});
		}

		this.assertWanditHostedFileParts(validated);

		return validated;
	}

	// Attachments ride user messages as AI SDK file parts (contract §10.4),
	// and ask_user "attachments" answers carry uploaded files in the tool
	// output. Every such URL must be one of our own R2 objects —
	// isWanditHostedUrl compares parsed origin + path boundary, so data:
	// URLs, foreign hosts, and prefix-confusable hosts are all rejected.
	private assertWanditHostedFileParts(
		messages: readonly WanditUIMessage[],
	): void {
		const reject = (): never => {
			throw new BadRequestException({
				code: "INVALID_FILE_PART",
				message: "Attachments must be uploaded through Wandit",
			});
		};

		for (const message of messages) {
			for (const part of message.parts) {
				if (message.role === "user" && part.type === "file") {
					if (!isWanditHostedUrl(part.url)) {
						reject();
					}

					continue;
				}

				// ask_user outputs are client-supplied (addToolResult) — their
				// uploaded-file URLs need the same host validation as file parts.
				if (
					part.type === "tool-ask_user" &&
					part.state === "output-available"
				) {
					for (const file of part.output.files ?? []) {
						if (!isWanditHostedUrl(file.url)) {
							reject();
						}
					}
				}
			}
		}
	}
}

/**
 * Country of the visitor as reported by the trusted edge (Vercel proxy or
 * Cloudflare). Best-effort context, not security input: it only biases the
 * lead-scrape default location, so an absent/garbage header degrades to null.
 * "XX"/"T1" are Cloudflare's unknown/Tor sentinels.
 */
function readRequestCountryCode(
	headers: FastifyRequest["headers"],
): string | null {
	const raw = headers["x-vercel-ip-country"] ?? headers["cf-ipcountry"];
	const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase();

	if (!value || !/^[A-Z]{2}$/.test(value) || value === "XX" || value === "T1") {
		return null;
	}

	return value;
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
