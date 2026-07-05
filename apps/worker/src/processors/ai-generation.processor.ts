import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import {
	AI_GENERATION_QUEUE,
	type AiGenerationJobData,
	type AiGenerationJobName,
} from "@wandit/jobs";
import { convertToModelMessages, streamText } from "ai";
import type { Job } from "bullmq";

import { buildSystemPrompt } from "../generation/system-prompt";
import {
	toChatMessage,
	WorkerChatRepository,
} from "../infrastructure/persistence/worker-chat.repository";
import {
	InsufficientCreditsError,
	WorkerCreditsService,
} from "../infrastructure/persistence/worker-credits.service";
import { ChatEventsPublisher } from "../infrastructure/redis/chat-events.publisher";

const GENERATION_ERROR_MESSAGE_MAX_LENGTH = 300;
const GATEWAY_ERROR_MARKER = Symbol.for("vercel.ai.gateway.error");

@Processor(AI_GENERATION_QUEUE)
export class AiGenerationProcessor extends WorkerHost {
	private readonly logger = new Logger(AiGenerationProcessor.name);

	constructor(
		@Inject(WorkerChatRepository)
		private readonly workerChatRepository: WorkerChatRepository,
		@Inject(WorkerCreditsService)
		private readonly workerCreditsService: WorkerCreditsService,
		@Inject(ChatEventsPublisher)
		private readonly chatEventsPublisher: ChatEventsPublisher,
	) {
		super();
	}

	async process(job: Job<AiGenerationJobData, unknown, AiGenerationJobName>) {
		this.logger.log(`Received ${job.name} job ${job.id}`);

		if (job.name !== "generate-copy") {
			return {
				processed: false,
				reason: "Reserved generation job",
			};
		}

		const data = job.data;
		const jobId = data.jobId;
		const assistantMessageId = assistantMessageIdForJob(jobId);
		let hasStreamError = false;
		let streamError: unknown;
		const captureStreamError = (error: unknown) => {
			if (!hasStreamError) {
				streamError = error;
				hasStreamError = true;
			}
		};

		try {
			await this.chatEventsPublisher.markStarted(data.chatId, jobId);
			this.assertGatewayConfigured();
			await this.chatEventsPublisher.publishThinking(data.chatId);

			const context =
				await this.workerChatRepository.loadGenerationContext(data);
			const modelMessages = await convertToModelMessages(
				context.messages.map(({ id: _id, ...message }) => message),
			);
			const result = streamText({
				messages: modelMessages,
				model: env.AI_CHAT_MODEL,
				onError: ({ error }) => {
					captureStreamError(error);
				},
				system: buildSystemPrompt(data.composer),
			});
			let text = "";

			try {
				for await (const part of result.stream) {
					if (part.type === "error") {
						captureStreamError(part.error);
						continue;
					}

					if (part.type !== "text-delta") {
						continue;
					}

					const delta = part.text;
					text += delta;
					await this.chatEventsPublisher.publishDelta({
						chatId: data.chatId,
						delta,
						jobId,
						messageId: assistantMessageId,
					});
				}
			} catch (error) {
				throw hasStreamError ? streamError : error;
			}

			if (hasStreamError) {
				throw streamError;
			}

			const [usage, finishReason] = await Promise.all([
				result.usage,
				result.finishReason,
			]);
			const assistantMessage =
				await this.workerChatRepository.insertAssistantMessage({
					chatId: data.chatId,
					id: assistantMessageId,
					metadata: {
						finishReason,
						jobId,
						model: env.AI_CHAT_MODEL,
						usage,
					},
					text,
				});

			await this.consumeCreditsAfterPersist(data, jobId);
			await this.chatEventsPublisher.publishMessageCompleted(
				data.chatId,
				toChatMessage(assistantMessage),
			);
			await this.chatEventsPublisher.publishDone(data.chatId, jobId);

			return {
				messageId: assistantMessage.id,
				processed: true,
			};
		} catch (error) {
			await this.publishFailureEvents(data.chatId, jobId, error);
			throw error;
		} finally {
			await this.clearActiveSafely(data.chatId, jobId);
		}
	}

	private async consumeCreditsAfterPersist(
		data: AiGenerationJobData,
		jobId: string,
	): Promise<void> {
		try {
			await this.workerCreditsService.consumeForGeneration(
				data.userId,
				data.action,
				jobId,
			);
		} catch (error) {
			if (error instanceof InsufficientCreditsError) {
				// The send-time gate owns user-facing credit failures; completed output
				// should still be delivered if the post-persist consume races balance.
				this.logger.warn(error.message);
				return;
			}

			throw error;
		}
	}

	private async publishFailureEvents(
		chatId: string,
		jobId: string,
		error: unknown,
	): Promise<void> {
		const generationError = toPublishedGenerationError(error);

		await this.tryPublish("error", () =>
			this.chatEventsPublisher.publishError(chatId, generationError),
		);
		await this.tryPublish("done", () =>
			this.chatEventsPublisher.publishDone(chatId, jobId),
		);
	}

	private async clearActiveSafely(
		chatId: string,
		jobId: string,
	): Promise<void> {
		try {
			await this.chatEventsPublisher.clearActive(chatId, jobId);
		} catch (error) {
			this.logger.error(
				`Failed to clear active generation ${jobId}`,
				error instanceof Error ? error.stack : String(error),
			);
		}
	}

	private async tryPublish(
		eventName: string,
		publish: () => Promise<void>,
	): Promise<void> {
		try {
			await publish();
		} catch (error) {
			this.logger.error(
				`Failed to publish generation ${eventName} event`,
				error instanceof Error ? error.stack : String(error),
			);
		}
	}

	private assertGatewayConfigured() {
		if (!env.AI_GATEWAY_API_KEY) {
			throw new Error("AI_GATEWAY_API_KEY is required for generation");
		}
	}
}

function assistantMessageIdForJob(jobId: string): string {
	// Text message ids can use a stable per-job namespace, making BullMQ
	// replay idempotent.
	return `assistant:${jobId}`;
}

function toPublishedGenerationError(error: unknown): {
	code: string;
	message: string;
} {
	const preferredError = preferredProviderError(error);

	return {
		code: generationErrorCode(preferredError),
		message: truncateMessage(
			errorMessage(preferredError) ??
				errorMessage(error) ??
				"Generation failed",
		),
	};
}

function generationErrorCode(error: unknown): string {
	const gatewayError = findGatewayError(error);

	if (gatewayError?.statusCode === 403) {
		return "GATEWAY_FORBIDDEN";
	}

	if (gatewayError?.statusCode === 429) {
		return "GATEWAY_RATE_LIMITED";
	}

	return "GENERATION_FAILED";
}

function preferredProviderError(error: unknown): unknown {
	return retryLastError(error) ?? error;
}

function retryLastError(error: unknown): unknown | undefined {
	if (!isRecord(error)) {
		return undefined;
	}

	if (error.lastError != null) {
		return error.lastError;
	}

	if (!Array.isArray(error.errors) || error.errors.length === 0) {
		return undefined;
	}

	return error.errors[error.errors.length - 1];
}

function findGatewayError(error: unknown): { statusCode: number } | undefined {
	const preferredError = preferredProviderError(error);

	if (preferredError !== error) {
		return findGatewayError(preferredError);
	}

	if (!isRecord(error)) {
		return undefined;
	}

	if (
		error[GATEWAY_ERROR_MARKER] === true &&
		typeof error.statusCode === "number"
	) {
		return { statusCode: error.statusCode };
	}

	return findGatewayError(error.cause);
}

function errorMessage(error: unknown): string | undefined {
	let message: string | undefined;

	if (error instanceof Error) {
		message = error.message;
	} else if (typeof error === "string") {
		message = error;
	} else if (isRecord(error) && typeof error.message === "string") {
		message = error.message;
	}

	const normalized = message?.trim();

	return normalized ? normalized : undefined;
}

function truncateMessage(message: string): string {
	return message.length > GENERATION_ERROR_MESSAGE_MAX_LENGTH
		? `${message.slice(0, GENERATION_ERROR_MESSAGE_MAX_LENGTH - 3)}...`
		: message;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === "object" && value !== null;
}
