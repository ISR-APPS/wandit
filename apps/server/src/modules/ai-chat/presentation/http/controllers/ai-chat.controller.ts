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
	aiChatBillingErrorDataSchema,
	aiChatMessageMetadataSchema,
	aiChatRequestMetadataSchema,
	uuidSchema,
} from "@wandit/contracts";
import { validateUIMessages } from "ai";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { readRequestCountryCode } from "../../../../../infrastructure/http/request-country-code";
import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import {
	isUserUploadUrl,
	isWanditUploadUrl,
} from "../../../../../infrastructure/storage/r2";
import { CurrentUser } from "../../../../auth";
import { ChatsRepository } from "../../../../generation/infrastructure/persistence/chats.repository";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { CurrentWorkspace } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import {
	aiChatToolsForValidation,
	type WanditUIMessage,
} from "../../../agent/chat-agent";
import { AiChatService } from "../../../application/services/ai-chat.service";

const aiChatRequestBodySchema = z.object({
	id: z.string().min(1).optional(),
	messageId: z.string().min(1).optional(),
	messages: z.array(z.unknown()),
	metadata: aiChatRequestMetadataSchema.optional(),
	trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
});

// validateUIMessages invokes the metadata schema even when metadata is absent.
// Normalize historical null/absent values to an empty optional-field object.
const aiChatValidationMetadataSchema = z.preprocess(
	(value) => value ?? {},
	aiChatMessageMetadataSchema,
);

type AiChatRequestBody = z.infer<typeof aiChatRequestBodySchema>;

/**
 * Idempotency id for one stream turn. NEVER body.id: the AI SDK transport
 * sends the CHAT id there, which is constant across turns — using it as the
 * at-most-once key marks every turn after the first as a replay (409) and
 * caps chats at a single exchange. body.messageId is trusted only on
 * "regenerate-message", where it names the message being regenerated. On
 * "submit-message" the SDK fills messageId with the LAST message's id for
 * every no-arg retry and ask_user/approval auto-resubmit — that is the
 * assistant row the turn keeps extending, so the id repeats while the
 * conversation advances, and keying on it welded each failed continuation to
 * all of its retries (one mid-stream failure then 409'd the turn forever).
 * Returning undefined lets the service key the turn on the turnRequestId
 * transcript fingerprint, which tells an answered round or a
 * retry-with-progress apart from the attempt it replaces.
 */
export function streamRequestId(
	body: Pick<AiChatRequestBody, "messageId" | "trigger">,
): string | undefined {
	return body.trigger === "regenerate-message" ? body.messageId : undefined;
}

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
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const scope = projectScopeFrom(workspace, user.id);
		const chat = await this.chatsRepository.findAccessibleChatById(
			scope,
			chatId,
		);

		if (!chat) {
			throw new NotFoundException();
		}

		if (hasSystemMessage(body.messages)) {
			throw new BadRequestException({
				code: "SYSTEM_MESSAGES_NOT_ALLOWED",
				message: "System messages must be configured on the server",
			});
		}

		// Which submitted messages are server-hydrated history vs new content:
		// history in a shared org chat legitimately carries other members'
		// attachments, so only NEW messages get the strict per-user file check.
		const persistedMessageIds = await this.chatsRepository.listMessageIds(
			chat.id,
		);
		const messages = await this.validateMessages(
			body.messages,
			user.id,
			persistedMessageIds,
		);
		const prepared = await this.aiChatService.prepareStream({
			chatId: chat.id,
			messages,
			projectId: chat.projectId,
			requestId: streamRequestId(body),
			scope,
		});
		const abortController = new AbortController();

		request.raw.once("close", () => abortController.abort());

		// The AI SDK owns this raw SSE response and its UI-message protocol.
		try {
			reply.hijack();
			await this.aiChatService.stream({
				abortSignal: abortController.signal,
				chatId: chat.id,
				messages,
				metadata: body.metadata,
				origin: request.headers.origin,
				prepared,
				// The generate_page and page-edit tools act on the chat's project;
				// the access query above already proved this scope may reach it.
				projectId: chat.projectId,
				reply,
				requestCountryCode: readRequestCountryCode(request.headers),
				scope,
			});
		} catch (error) {
			prepared.release();
			throw error;
		}
	}

	private async validateMessages(
		messages: unknown[],
		userId: string,
		persistedMessageIds: ReadonlySet<string>,
	): Promise<WanditUIMessage[]> {
		// Historical failed streams could persist empty assistant messages. They carry
		// no transcript information, so discard them here as a defensive safeguard.
		const nonEmptyMessages = messages.filter(
			(message) => !hasEmptyParts(message),
		);

		let validated: WanditUIMessage[];

		try {
			validated = await validateUIMessages<WanditUIMessage>({
				dataSchemas: { "billing-error": aiChatBillingErrorDataSchema },
				messages: nonEmptyMessages,
				metadataSchema: aiChatValidationMetadataSchema,
				tools: aiChatToolsForValidation,
			});
		} catch {
			throw new BadRequestException({
				code: "INVALID_UI_MESSAGES",
				message: "Messages do not match the AI chat protocol",
			});
		}

		assertOwnedFileParts(validated, userId, persistedMessageIds);

		return validated;
	}
}

/**
 * Attachments ride user messages as AI SDK file parts (contract §10.4), and
 * ask_user "attachments" answers carry uploaded files in the tool output.
 *
 * NEW messages (not yet persisted) must carry only R2 uploads beneath the
 * ACTING user's own prefix. PERSISTED history is re-validated as "some Wandit
 * upload" without owner binding: the web transport resubmits the full
 * transcript on every turn, and in a shared org chat that history
 * legitimately contains other members' attachments — each already passed the
 * strict check when its author submitted it. Foreign hosts and
 * generated-site assets are rejected in both modes.
 */
export function assertOwnedFileParts(
	messages: readonly WanditUIMessage[],
	userId: string,
	persistedMessageIds: ReadonlySet<string>,
): void {
	const reject = (): never => {
		throw new BadRequestException({
			code: "INVALID_FILE_PART",
			message: "Attachments must be uploaded through Wandit",
		});
	};

	for (const message of messages) {
		const isPersisted = persistedMessageIds.has(message.id);
		const isAllowedUrl = (url: string): boolean =>
			isPersisted ? isWanditUploadUrl(url) : isUserUploadUrl(url, userId);

		for (const part of message.parts) {
			if (message.role === "user" && part.type === "file") {
				if (!isAllowedUrl(part.url)) {
					reject();
				}

				continue;
			}

			// ask_user outputs are client-supplied (addToolResult) — their
			// uploaded-file URLs need the same ownership validation as file parts.
			if (part.type === "tool-ask_user" && part.state === "output-available") {
				for (const file of part.output.files ?? []) {
					if (!isAllowedUrl(file.url)) {
						reject();
					}
				}
			}
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
