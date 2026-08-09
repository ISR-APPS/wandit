/**
 * Main service for chat API actions.
 *
 * Controller = HTTP layer.
 * Service = business flow layer.
 *
 * This service does not call the AI model. It checks ownership, checks credits,
 * saves the user message, reserves the chat in Redis, and puts a job in BullMQ.
 * The worker app later reads that job and calls the model.
 */
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { randomUUID } from "node:crypto";
import {
	type HttpException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
// Shared request/response types used by both the API and frontend.
import type {
	ChatByProjectResponse,
	ChatMessagesResponse,
	SendChatMessageBody,
	SendChatMessageResponse,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { MeteringService } from "../../../metering/application/services/metering.service";
import { operationPricing } from "../../../metering/domain/operation-registry";
import { GenerationActiveError } from "../../domain/errors/generation-active.error";
import { mapMessageRow } from "../../infrastructure/mappers/chat-message.mapper";
// Repository = database helper. The service uses it instead of writing SQL here.
import { ChatsRepository } from "../../infrastructure/persistence/chats.repository";
import { GenerationActivityService } from "./generation-activity.service";
import {
	GenerationQueueOutcomeUnknownError,
	GenerationQueueService,
} from "./generation-queue.service";

// `@Injectable()` means Nest can create this class and inject it into controllers.
@Injectable()
export class ChatService {
	private readonly logger = new Logger(ChatService.name);

	constructor(
		// `@Inject(...)` means: "Nest, give me this dependency." Similar to passing
		// helpers into an Express route factory, but Nest does it automatically.
		@Inject(ChatsRepository)
		private readonly chatsRepository: ChatsRepository,
		@Inject(GenerationActivityService)
		private readonly generationActivityService: GenerationActivityService,
		@Inject(GenerationQueueService)
		private readonly generationQueueService: GenerationQueueService,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
	) {}

	// The workspace knows `projectId`; chat endpoints need `chatId`.
	// LIVE read (used by the current editor): workspace-scoped.
	async getByProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<ChatByProjectResponse> {
		// If no row is found, either it does not exist or it is out of scope.
		const chat = await this.chatsRepository.findAccessibleChatByProjectId(
			scope,
			projectId,
		);

		if (!chat) {
			throw new NotFoundException();
		}

		return {
			chatId: chat.id,
			projectId: chat.projectId,
		};
	}

	// Load saved messages and ask Redis if a generation is currently running.
	// LIVE read (used by the current editor): workspace-scoped.
	async listMessages(
		scope: ProjectScope,
		chatId: string,
	): Promise<ChatMessagesResponse> {
		const chat = await this.requireAccessibleChat(scope, chatId);
		// Postgres stores history. Redis stores temporary "busy" state.
		const [messages, activeJobId] = await Promise.all([
			this.chatsRepository.listMessages(chat.id),
			this.generationActivityService.getActiveJobId(chat.id),
		]);

		return {
			generationActive: activeJobId !== null,
			messages: messages.map(mapMessageRow),
		};
	}

	// Save the user's message and enqueue the background AI job.
	async sendMessage(
		userId: string,
		chatId: string,
		body: SendChatMessageBody,
	): Promise<SendChatMessageResponse> {
		// First make sure this chat belongs to this user. The legacy BullMQ send
		// path stays personal-only by design (teams-workspaces.md §0).
		const chat = await this.requireOwnedChat(userId, chatId);

		// One id connects the Redis lock, BullMQ job, stream events, and assistant message.
		const jobId = randomUUID();
		// Reserve the chat so only one assistant answer is generated at a time.
		const reserved = await this.generationActivityService.reserveActive(
			chat.id,
			jobId,
		);

		if (!reserved) {
			throw new GenerationActiveError();
		}

		let messageId: string | null = null;
		let usageEventId: string | null = null;
		const billingMode =
			env.GENERATION_BILLING_MODE === "off" ? "off" : "enforce";
		let failureStage: "enqueue" | "insert" | "reserve" = "insert";

		try {
			// Save the user prompt before the worker starts.
			const message = await this.chatsRepository.insertUserMessage({
				chatId: chat.id,
				composer: body.composer,
				text: body.text,
			});
			messageId = message.id;
			failureStage = "reserve";

			if (billingMode === "enforce") {
				const reservation = await this.meteringService.reserve(
					"chat",
					// Legacy path is personal-only by design (teams-workspaces.md §0).
					{ actorUserId: userId },
					{
					attemptRef: jobId,
					chatId: chat.id,
					credits: operationPricing("chat").reserveFloorCredits,
					idempotencyKey: `legacy-chat:${jobId}`,
					messageId: message.id,
					model: env.AI_CHAT_MODEL,
				});
				usageEventId = reservation.id;
			}

			failureStage = "enqueue";

			// Add a BullMQ job. The worker will call the AI and stream the answer.
			const queued = await this.generationQueueService.enqueueGenerateCopy({
				action: "chatMessage",
				billingMode,
				chatId: chat.id,
				composer: body.composer,
				jobId,
				messageId: message.id,
				projectId: chat.projectId,
				prompt: body.text,
				usageEventId,
				userId,
			});

			return {
				jobId: queued.jobId,
				messageId: message.id,
			};
		} catch (error) {
			const outcomeUnknown =
				error instanceof GenerationQueueOutcomeUnknownError;
			// DB, Redis, and BullMQ are different systems. If one step fails after
			// another succeeded, compensate only when BullMQ definitively did not
			// accept the job. An unknown outcome may still deliver asynchronously.
			if (!outcomeUnknown) {
				await this.compensateFailedSend(
					chat.id,
					jobId,
					messageId,
					usageEventId,
				);
			}

			// If the failure happened while queueing, return a stable 503 error.
			if (failureStage === "enqueue") {
				throw this.queueUnavailable(error);
			}

			throw error;
		}
	}

	// The stream route calls this before opening a long-lived SSE connection.
	async assertStreamAccess(userId: string, chatId: string): Promise<void> {
		await this.requireOwnedChat(userId, chatId);
	}

	// Shared "does this user own this chat?" check. Legacy generation stays
	// personal-only by design (teams-workspaces.md §0).
	private async requireOwnedChat(userId: string, chatId: string) {
		return this.requireAccessibleChat({ kind: "personal", userId }, chatId);
	}

	private async requireAccessibleChat(scope: ProjectScope, chatId: string) {
		const chat = await this.chatsRepository.findAccessibleChatById(
			scope,
			chatId,
		);

		if (!chat) {
			throw new NotFoundException();
		}

		return chat;
	}

	// Try to undo partial work if sending failed.
	private async compensateFailedSend(
		chatId: string,
		jobId: string,
		messageId: string | null,
		usageEventId: string | null,
	): Promise<void> {
		// `allSettled` runs all cleanup attempts even if one of them fails.
		const results = await Promise.allSettled([
			...(messageId ? [this.chatsRepository.deleteMessageById(messageId)] : []),
			...(usageEventId
				? [
						this.meteringService.refund(
							usageEventId,
							"legacy_chat_enqueue_failed",
						),
					]
				: []),
			this.generationActivityService.releaseActive(chatId, jobId),
		]);

		for (const result of results) {
			if (result.status === "rejected") {
				this.logger.error(
					`Failed to compensate chat generation ${jobId}`,
					result.reason instanceof Error
						? result.reason.stack
						: String(result.reason),
				);
			}
		}
	}

	// Convert queue errors into a clear HTTP 503.
	private queueUnavailable(error: unknown): HttpException {
		if (error instanceof ServiceUnavailableException) {
			return error;
		}

		return new ServiceUnavailableException({
			code: "GENERATION_QUEUE_UNAVAILABLE",
			message: "Generation queue could not be reached",
		});
	}
}
