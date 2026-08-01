// Worker processor for AI chat generation jobs.
//
// The API already saved the user message and added a BullMQ job.
// This worker reads that job and does the slow work:
// 1. load chat history
// 2. call the AI model
// 3. publish live text deltas to Redis
// 4. save the final assistant message
// 5. spend credits
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import {
	AI_GENERATION_QUEUE,
	type AiGenerationJobData,
	type AiGenerationJobName,
} from "@wandit/jobs";
import { Sentry } from "@wandit/observability/node";
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

// Do not send huge provider errors to the browser.
const GENERATION_ERROR_MESSAGE_MAX_LENGTH = 300;
// AI Gateway uses this marker on some errors.
const GATEWAY_ERROR_MARKER = Symbol.for("vercel.ai.gateway.error");

// `@Processor(queueName)` tells BullMQ/Nest this class handles jobs from a queue.
@Processor(AI_GENERATION_QUEUE)
export class AiGenerationProcessor extends WorkerHost {
	private readonly logger = new Logger(AiGenerationProcessor.name);

	constructor(
		// Nest injects these helpers. The processor does not create them manually.
		@Inject(WorkerChatRepository)
		private readonly workerChatRepository: WorkerChatRepository,
		@Inject(WorkerCreditsService)
		private readonly workerCreditsService: WorkerCreditsService,
		@Inject(ChatEventsPublisher)
		private readonly chatEventsPublisher: ChatEventsPublisher,
	) {
		super();
	}

	// BullMQ calls this method once for each queued job.
	async process(job: Job<AiGenerationJobData, unknown, AiGenerationJobName>) {
		this.logger.log(`Received ${job.name} job ${job.id}`);

		// This worker currently handles only "generate-copy".
		if (job.name !== "generate-copy") {
			return {
				processed: false,
				reason: "Reserved generation job",
			};
		}

		const data = job.data;
		const jobId = data.jobId;
		const assistantMessageId = assistantMessageIdForJob(jobId);
		// Some AI SDK errors arrive through callbacks/stream parts, not thrown.
		// Keep the first one so we can publish one clear error event.
		let hasStreamError = false;
		let streamError: unknown;
		const captureStreamError = (error: unknown) => {
			if (!hasStreamError) {
				streamError = error;
				hasStreamError = true;
			}
		};

		try {
			// Mark chat as busy and publish "started".
			await this.chatEventsPublisher.markStarted(data.chatId, jobId);
			this.assertGatewayConfigured();
			await this.chatEventsPublisher.publishThinking(data.chatId);

			// Load messages and verify the job points to the expected user/project.
			const context =
				await this.workerChatRepository.loadGenerationContext(data);
			// Convert saved UI messages into model messages for the AI SDK.
			const modelMessages = await convertToModelMessages(
				context.messages.map(({ id: _id, ...message }) => message),
			);
			// Start the model request and receive an async stream of parts.
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
				// Each text delta is saved locally and published to Redis immediately.
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
				// Prefer the captured provider error if one exists.
				throw hasStreamError ? streamError : error;
			}

			// Some provider errors are captured without throwing inside the loop.
			if (hasStreamError) {
				throw streamError;
			}

			// Store usage/finish metadata with the assistant message.
			const [usage, finishReason] = await Promise.all([
				result.usage,
				result.finishReason,
			]);
			// Save before publishing completion, so reload can fetch the final message.
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
			// Send final message, then send "done" so UI clears busy state.
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
			// BullMQ records the failure but nothing reports it — the original
			// provider error used to vanish here (UI only gets a truncated copy).
			Sentry.captureException(error, {
				tags: { chatId: data.chatId, jobId, userId: data.userId },
			});
			// Tell the UI about the failure, then rethrow so BullMQ records it.
			await this.publishFailureEvents(data.chatId, jobId, error);
			throw error;
		} finally {
			// Always try to clear the busy flag for this job.
			await this.clearActiveSafely(data.chatId, jobId);
		}
	}

	// Spend credits after the assistant message is saved.
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
				// The answer is already saved, so deliver it and log the credit mismatch.
				this.logger.warn(error.message);
				return;
			}

			throw error;
		}
	}

	// Publish error + done so the browser does not stay stuck in loading state.
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

	// Clear the busy flag, but do not hide the original error if cleanup fails.
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

	// During failures, try each publish independently.
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

	// Fail fast if the worker has no AI Gateway key.
	private assertGatewayConfigured() {
		if (!env.AI_GATEWAY_API_KEY) {
			throw new Error("AI_GATEWAY_API_KEY is required for generation");
		}
	}
}

// Use job id to make assistant message id stable across retries.
function assistantMessageIdForJob(jobId: string): string {
	// Same job -> same assistant message id.
	return `assistant:${jobId}`;
}

// Convert any error into the small error shape sent to the browser.
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

// Map known AI Gateway status codes to stable UI error codes.
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

// Retry errors may wrap the real provider error. Prefer the real one.
function preferredProviderError(error: unknown): unknown {
	return retryLastError(error) ?? error;
}

// Get the last underlying error from retry-shaped objects.
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

// Search nested errors for an AI Gateway status code.
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

// Safely get a readable message from an unknown thrown value.
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

// Keep error messages short before sending them to the browser.
function truncateMessage(message: string): string {
	return message.length > GENERATION_ERROR_MESSAGE_MAX_LENGTH
		? `${message.slice(0, GENERATION_ERROR_MESSAGE_MAX_LENGTH - 3)}...`
		: message;
}

// Runtime check before reading properties from an unknown value.
function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === "object" && value !== null;
}
