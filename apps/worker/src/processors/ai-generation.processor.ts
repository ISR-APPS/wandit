// Worker processor for AI chat generation jobs.
//
// The API already saved the user message and added a BullMQ job.
// This worker reads that job and does the slow work:
// 1. load chat history
// 2. call the AI model
// 3. publish live text deltas to Redis
// 4. save the final assistant message
// 5. settle the durable AI usage reservation
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";
import {
	AI_GENERATION_QUEUE,
	type AiGenerationJobData,
	type AiGenerationJobName,
} from "@wandit/jobs";
import { Sentry } from "@wandit/observability/node";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { Job } from "bullmq";
import { MeteringService } from "../../../server/src/modules/metering/application/services/metering.service";
import {
	gatewayGenerationCaptureFromError,
	withGatewayAttribution,
} from "../../../server/src/modules/metering/domain/gateway-metering";
import { buildSystemPrompt } from "../generation/system-prompt";
import {
	toChatMessage,
	WorkerChatRepository,
} from "../infrastructure/persistence/worker-chat.repository";
import { ChatEventsPublisher } from "../infrastructure/redis/chat-events.publisher";

// Do not send huge provider errors to the browser.
const GENERATION_ERROR_MESSAGE_MAX_LENGTH = 300;
const LEGACY_CHAT_MAX_OUTPUT_TOKENS = 4_096;
const LEGACY_CHAT_MAX_STEPS = 1;
const LEGACY_METERING_WRITE_ATTEMPTS = 3;
// Metering recovery refunds reservations at 40 minutes. Do not begin provider
// work so late that the sweep can refund a live request: 30m queue age + 8m
// provider ceiling leaves two minutes for capture, save, and settlement.
const LEGACY_CHAT_MAX_START_AGE_MS = 30 * 60 * 1000;
const LEGACY_CHAT_PROVIDER_TIMEOUT_MS = 8 * 60 * 1000;
// AI Gateway uses this marker on some errors.
const GATEWAY_ERROR_MARKER = Symbol.for("vercel.ai.gateway.error");

class LegacyChatStartWindowExpiredError extends Error {
	constructor(
		readonly eventId: string,
		jobId: string,
	) {
		super(`Legacy generation job ${jobId} waited too long to start safely`);
		this.name = "LegacyChatStartWindowExpiredError";
	}
}

// `@Processor(queueName)` tells BullMQ/Nest this class handles jobs from a queue.
@Processor(AI_GENERATION_QUEUE)
export class AiGenerationProcessor extends WorkerHost {
	private readonly logger = new Logger(AiGenerationProcessor.name);

	constructor(
		// Nest injects these helpers. The processor does not create them manually.
		@Inject(WorkerChatRepository)
		private readonly workerChatRepository: WorkerChatRepository,
		@Inject(ChatEventsPublisher)
		private readonly chatEventsPublisher: ChatEventsPublisher,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
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
		let assistantSaved = false;
		let generationCaptured = false;
		let meteringReservationVerified = false;
		let providerStreamStarted = false;
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
			meteringReservationVerified = await this.assertMeteringReservation(data);
			this.assertGatewayConfigured();
			await this.chatEventsPublisher.publishThinking(data.chatId);

			// Load messages and verify the job points to the expected user/project.
			const context =
				await this.workerChatRepository.loadGenerationContext(data);
			// Convert saved UI messages into model messages for the AI SDK.
			const modelMessages = await convertToModelMessages(
				context.messages.map(({ id: _id, ...message }) => message),
			);
			// Loading a large history can take long enough to cross the safe-start
			// boundary after the queue preflight. Re-read the durable event at the
			// final possible moment before the provider call so the 40-minute sweep
			// can never refund work that starts late.
			meteringReservationVerified = await this.assertMeteringReservation(data);
			// Start the model request and receive an async stream of parts.
			const result = streamText({
				abortSignal: AbortSignal.timeout(LEGACY_CHAT_PROVIDER_TIMEOUT_MS),
				maxOutputTokens: LEGACY_CHAT_MAX_OUTPUT_TOKENS,
				messages: modelMessages,
				model: env.AI_CHAT_MODEL,
				onError: ({ error }) => {
					captureStreamError(error);
				},
				providerOptions: withGatewayAttribution(
					{},
					{ operation: "chat", userId: data.userId },
				),
				stopWhen: stepCountIs(LEGACY_CHAT_MAX_STEPS),
				system: buildSystemPrompt(data.composer),
			});
			providerStreamStarted = true;
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
			const [usage, finishReason, providerMetadata] = await Promise.all([
				result.usage,
				result.finishReason,
				result.providerMetadata,
			]);
			if (data.usageEventId) {
				const usageEventId = data.usageEventId;
				try {
					await retryMeteringWrite(async () => {
						const captured = await this.meteringService.captureGeneration(
							usageEventId,
							{
								providerMetadata,
								stepUsage: usage,
							},
						);

						if (!captured) {
							throw new Error(
								`Legacy generation ${jobId} did not expose a gateway generation id`,
							);
						}

						return captured;
					});

					generationCaptured = true;
				} catch (error) {
					// Generation-ref persistence is diagnostic/reconciliation state. Once
					// the stream completed, do not let it block the durable assistant save
					// and token settlement that prevent delivered text from becoming free.
					Sentry.captureException(error, {
						tags: { chatId: data.chatId, jobId, userId: data.userId },
					});
					this.logger.error(
						`Failed to capture legacy generation reference for ${jobId}`,
						error instanceof Error ? error.stack : String(error),
					);
				}
			}
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
			assistantSaved = true;

			if (data.usageEventId) {
				const usageEventId = data.usageEventId;
				await retryMeteringWrite(() =>
					this.meteringService.settle(usageEventId, {
						modelId: env.AI_CHAT_MODEL,
						pricing: "token",
						provider: "gateway",
						rawUsage: usage,
						usage,
					}),
				);
			}
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
			const expiredBeforeProvider =
				error instanceof LegacyChatStartWindowExpiredError;
			if (
				!expiredBeforeProvider &&
				!generationCaptured &&
				data.usageEventId &&
				meteringReservationVerified
			) {
				generationCaptured = await this.captureGatewayErrorSafely(
					data.usageEventId,
					error,
					data,
				);
			}
			if (expiredBeforeProvider) {
				await this.refundFailedReservationSafely(
					error.eventId,
					"legacy_chat_generation_expired_before_start",
				);
			}
			if (
				!expiredBeforeProvider &&
				!assistantSaved &&
				!generationCaptured &&
				!providerStreamStarted &&
				data.usageEventId &&
				meteringReservationVerified
			) {
				await this.refundFailedReservationSafely(data.usageEventId);
			}
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

	private async captureGatewayErrorSafely(
		eventId: string,
		error: unknown,
		data: AiGenerationJobData,
	): Promise<boolean> {
		const capture = gatewayGenerationCaptureFromError(error);

		if (!capture) {
			return false;
		}

		try {
			await retryMeteringWrite(async () => {
				const generationRef = await this.meteringService.captureGeneration(
					eventId,
					capture,
				);

				if (!generationRef) {
					throw new Error(
						`Legacy generation ${data.jobId} gateway error did not expose a valid generation id`,
					);
				}

				return generationRef;
			});

			return true;
		} catch (captureError) {
			Sentry.captureException(captureError, {
				tags: {
					chatId: data.chatId,
					jobId: data.jobId,
					meteringPhase: "capture_gateway_error",
					userId: data.userId,
				},
			});
			this.logger.error(
				`Failed to capture legacy gateway error for ${data.jobId}`,
				captureError instanceof Error
					? captureError.stack
					: String(captureError),
			);

			return false;
		}
	}

	private async refundFailedReservationSafely(
		eventId: string,
		reason = "legacy_chat_generation_failed",
	): Promise<void> {
		try {
			await this.meteringService.refund(eventId, reason);
		} catch (error) {
			this.logger.error(
				`Failed to refund AI usage reservation ${eventId}`,
				error instanceof Error ? error.stack : String(error),
			);
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

	private async assertMeteringReservation(
		data: AiGenerationJobData,
	): Promise<boolean> {
		if (data.billingMode === "off") {
			if (data.usageEventId !== null) {
				throw new Error(
					"Billing-off generation job must not carry an AI usage reservation",
				);
			}

			return false;
		}

		// usageEventId was already required when billingMode was introduced.
		// Therefore a pre-field payload carrying an explicit null is itself a
		// durable billing-off admission snapshot, independent of today's switch.
		if (data.billingMode === undefined && data.usageEventId === null) {
			return false;
		}

		if (!data.usageEventId) {
			// Payloads queued before billingMode was introduced retain the old
			// runtime-switch behavior only if both billing fields are absent. Every
			// new payload carries an explicit durable admission snapshot.
			if (
				data.billingMode === undefined &&
				env.GENERATION_BILLING_MODE === "off"
			) {
				return false;
			}

			throw new Error("Enforced generation job has no AI usage reservation");
		}

		const event = await this.meteringService.findByIdempotencyKey(
			`legacy-chat:${data.jobId}`,
			{ actorUserId: data.userId },
		);
		const matchesJob =
			event?.id === data.usageEventId &&
			event.operation === "chat" &&
			event.status === "reserved" &&
			event.attemptRef === data.jobId &&
			event.chatId === data.chatId &&
			event.messageId === data.messageId;

		if (!matchesJob) {
			throw new Error(
				`Legacy generation job ${data.jobId} has no matching active AI usage reservation`,
			);
		}

		if (
			Date.now() - event.createdAt.getTime() >=
			LEGACY_CHAT_MAX_START_AGE_MS
		) {
			throw new LegacyChatStartWindowExpiredError(event.id, data.jobId);
		}

		return true;
	}
}

async function retryMeteringWrite<T>(write: () => Promise<T>): Promise<T> {
	let lastError: unknown;

	for (
		let attempt = 0;
		attempt < LEGACY_METERING_WRITE_ATTEMPTS;
		attempt += 1
	) {
		try {
			return await write();
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Legacy generation metering write failed");
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
