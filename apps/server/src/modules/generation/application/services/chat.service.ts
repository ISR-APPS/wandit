import { randomUUID } from "node:crypto";
import {
	type HttpException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type {
	ChatByProjectResponse,
	ChatMessagesResponse,
	SendChatMessageBody,
	SendChatMessageResponse,
} from "@wandit/contracts";

import { GenerationActiveError } from "../../domain/errors/generation-active.error";
import { mapMessageRow } from "../../infrastructure/mappers/chat-message.mapper";
import { ChatsRepository } from "../../infrastructure/persistence/chats.repository";
import { GenerationActivityService } from "./generation-activity.service";
import { GenerationPolicyService } from "./generation-policy.service";
import { GenerationQueueService } from "./generation-queue.service";

@Injectable()
export class ChatService {
	private readonly logger = new Logger(ChatService.name);

	constructor(
		@Inject(ChatsRepository)
		private readonly chatsRepository: ChatsRepository,
		@Inject(GenerationActivityService)
		private readonly generationActivityService: GenerationActivityService,
		@Inject(GenerationPolicyService)
		private readonly generationPolicyService: GenerationPolicyService,
		@Inject(GenerationQueueService)
		private readonly generationQueueService: GenerationQueueService,
	) {}

	async getByProject(
		userId: string,
		projectId: string,
	): Promise<ChatByProjectResponse> {
		const chat = await this.chatsRepository.findOwnedChatByProjectId(
			userId,
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

	async listMessages(
		userId: string,
		chatId: string,
	): Promise<ChatMessagesResponse> {
		const chat = await this.requireOwnedChat(userId, chatId);
		const [messages, activeJobId] = await Promise.all([
			this.chatsRepository.listMessages(chat.id),
			this.generationActivityService.getActiveJobId(chat.id),
		]);

		return {
			generationActive: activeJobId !== null,
			messages: messages.map(mapMessageRow),
		};
	}

	async sendMessage(
		userId: string,
		chatId: string,
		body: SendChatMessageBody,
	): Promise<SendChatMessageResponse> {
		const chat = await this.requireOwnedChat(userId, chatId);

		await this.generationPolicyService.assertCanGenerate(userId, "chatMessage");

		const jobId = randomUUID();
		const reserved = await this.generationActivityService.reserveActive(
			chat.id,
			jobId,
		);

		if (!reserved) {
			throw new GenerationActiveError();
		}

		let messageId: string | null = null;
		let failureStage: "insert" | "enqueue" = "insert";

		try {
			const message = await this.chatsRepository.insertUserMessage({
				chatId: chat.id,
				composer: body.composer,
				text: body.text,
			});
			messageId = message.id;
			failureStage = "enqueue";

			const queued = await this.generationQueueService.enqueueGenerateCopy({
				action: "chatMessage",
				chatId: chat.id,
				composer: body.composer,
				jobId,
				messageId: message.id,
				projectId: chat.projectId,
				prompt: body.text,
				userId,
			});

			return {
				jobId: queued.jobId,
				messageId: message.id,
			};
		} catch (error) {
			await this.compensateFailedSend(chat.id, jobId, messageId);

			if (failureStage === "enqueue") {
				throw this.queueUnavailable(error);
			}

			throw error;
		}
	}

	async assertStreamAccess(userId: string, chatId: string): Promise<void> {
		await this.requireOwnedChat(userId, chatId);
	}

	private async requireOwnedChat(userId: string, chatId: string) {
		const chat = await this.chatsRepository.findOwnedChatById(userId, chatId);

		if (!chat) {
			throw new NotFoundException();
		}

		return chat;
	}

	private async compensateFailedSend(
		chatId: string,
		jobId: string,
		messageId: string | null,
	): Promise<void> {
		const results = await Promise.allSettled([
			...(messageId ? [this.chatsRepository.deleteMessageById(messageId)] : []),
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
