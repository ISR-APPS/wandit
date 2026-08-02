/**
 * Turns uploaded audio into text.
 *
 * The controller reads the uploaded file. This service sends the audio bytes to
 * the AI transcription model and returns the text.
 *
 * Note: we call the gateway model directly instead of the `transcribe()` helper
 * from the `ai` package. The helper guesses the audio format by looking at the
 * first bytes of the file, but its lookup table has a bug: it expects m4a files
 * to start with "ftyp", while real m4a files start with a 4-byte size first.
 * The guess then falls back to "audio/wav", and the gateway rejects the request
 * with "This model does not support the format you provided". We already know
 * the real content type from the upload, so we pass it ourselves.
 */
import { setTimeout as delay } from "node:timers/promises";
import { gateway } from "@ai-sdk/gateway";
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
} from "@nestjs/common";
// Shared response contract used by API and frontend, including replay reads.
import {
	type TranscriptionResponse,
	transcriptionResponseSchema,
} from "@wandit/contracts";
// Typed environment values, including model name and API key.
import { env } from "@wandit/env/server";
import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	gatewayGenerationCaptureFromError,
	withGatewayAttribution,
} from "../../../metering/domain/gateway-metering";
import {
	type AiUsageEvent,
	MeteringStateConflictError,
} from "../../../metering/domain/metering";
import {
	operationPricing,
	TRANSCRIPTION_MAX_DURATION_SECONDS,
	transcriptionCredits,
} from "../../../metering/domain/operation-registry";
import { AiGatewayNotConfiguredError } from "../../domain/errors/ai-gateway-not-configured.error";
import { readAudioDurationSeconds } from "./audio-duration";

const METERING_WRITE_ATTEMPTS = 3;
const TRANSCRIPTION_PROVIDER_TIMEOUT_MS = 10 * 60 * 1000;
const TRANSCRIPTION_CREDITS_PER_MINUTE = (() => {
	const pricing = operationPricing("transcription");

	if (pricing.mode !== "per_minute") {
		throw new Error("Transcription operation must use per-minute pricing");
	}

	return pricing.creditsPerMinute;
})();

// `@Injectable()` lets the controller inject this service.
@Injectable()
export class TranscriptionService {
	private readonly logger = new Logger(TranscriptionService.name);

	constructor(
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
	) {}

	// Run one transcription request.
	async transcribeAudio(input: {
		audio: Buffer;
		mimeType: string;
		operationId: string;
		userId: string;
	}): Promise<TranscriptionResponse> {
		const durationSeconds = readAudioDurationSeconds(
			input.audio,
			input.mimeType,
		);

		if (durationSeconds === null) {
			throw new BadRequestException({
				code: "AUDIO_DURATION_UNAVAILABLE",
				message: "The uploaded audio duration could not be read",
			});
		}

		if (durationSeconds > TRANSCRIPTION_MAX_DURATION_SECONDS) {
			throw audioDurationTooLong("container");
		}

		const credits = transcriptionCredits(durationSeconds);
		const idempotencyKey = `transcription:${input.userId}:${input.operationId}`;
		const billingEnabled = env.GENERATION_BILLING_MODE !== "off";
		// Billing-off disables new holds, but it must not erase a stable-key event
		// admitted before an operator flipped the switch. That event remains the
		// authority for replay/provider execution across process restarts.
		const existingWhileDisabled = billingEnabled
			? null
			: await this.meteringService.findByIdempotencyKey(
					idempotencyKey,
					input.userId,
				);

		// Reading an existing event is the only safe exception to the config
		// preflight: it lets a settled transport retry return its stored response.
		// This branch never calls reserveWithReplay, so missing configuration can
		// neither create a hold nor strand one between reserve and provider setup.
		if (!env.AI_GATEWAY_API_KEY) {
			const existing = billingEnabled
				? await this.meteringService.findByIdempotencyKey(
						idempotencyKey,
						input.userId,
					)
				: existingWhileDisabled;

			if (existing) {
				return replayExistingTranscription(existing, {
					credits,
					model: env.AI_TRANSCRIPTION_MODEL,
					operationId: input.operationId,
				});
			}

			this.assertGatewayConfigured();
		}

		this.assertGatewayConfigured();

		let reservation: Awaited<
			ReturnType<MeteringService["reserveWithReplay"]>
		> | null;

		try {
			reservation =
				billingEnabled || existingWhileDisabled
					? await this.meteringService.reserveWithReplay(
							"transcription",
							input.userId,
							{
								attemptRef: input.operationId,
								credits,
								idempotencyKey,
								model: env.AI_TRANSCRIPTION_MODEL,
							},
						)
					: null;
		} catch (error) {
			if (error instanceof MeteringStateConflictError) {
				throw transcriptionReplayConflict(
					"This transcription operation cannot execute again",
				);
			}

			throw error;
		}

		// A stable client operation id makes transport retries safe. A completed
		// operation returns the exact response stored with its settlement; an
		// in-flight operation remains a conflict so two provider calls cannot run.
		if (reservation?.replayed) {
			if (
				reservation.replay === "settled" ||
				reservation.replay === "reconciled"
			) {
				const response = storedTranscriptionResponse(
					reservation.event.rawUsage,
				);

				if (response) {
					return response;
				}
			}

			throw transcriptionReplayConflict(
				reservation.replay === "reserved"
					? "This transcription operation is already in progress"
					: "This transcription operation completed without a replayable response",
			);
		}

		// Resolve the configured model on the gateway and send the audio bytes
		// together with the real content type from the upload.
		const model = gateway.transcriptionModel(env.AI_TRANSCRIPTION_MODEL);
		let result: Awaited<ReturnType<typeof model.doGenerate>>;

		try {
			result = await model.doGenerate({
				abortSignal: AbortSignal.timeout(TRANSCRIPTION_PROVIDER_TIMEOUT_MS),
				audio: input.audio,
				mediaType: normalizeAudioMediaType(input.mimeType),
				providerOptions: withGatewayAttribution(
					{},
					{
						operation: "transcription",
						userId: input.userId,
					},
				),
			});
		} catch (error) {
			if (reservation) {
				await this.captureProviderFailureSafely(reservation.event.id, error);
				await this.refundProviderFailureSafely(reservation.event.id);
			}
			throw error;
		}

		const providerDurationSeconds = validProviderDurationSeconds(
			result.durationInSeconds,
		);
		const providerDurationExceedsLimit =
			providerDurationSeconds !== null &&
			providerDurationSeconds > TRANSCRIPTION_MAX_DURATION_SECONDS;
		const billableDurationSeconds = providerDurationExceedsLimit
			? TRANSCRIPTION_MAX_DURATION_SECONDS
			: (providerDurationSeconds ?? durationSeconds);
		const finalCredits = transcriptionCredits(billableDurationSeconds);
		const response: TranscriptionResponse | null = providerDurationExceedsLimit
			? null
			: {
					durationSec: billableDurationSeconds,
					text: result.text,
				};

		if (reservation) {
			let captureFailure: { error: unknown } | null = null;
			let settlementFailure: { error: unknown } | null = null;

			try {
				await retryMeteringWrite(async () => {
					const captured = await this.meteringService.captureGeneration(
						reservation.event.id,
						{
							providerMetadata: result.providerMetadata,
							stepUsage: {
								durationSeconds,
								providerDurationSeconds,
							},
						},
					);

					if (!captured) {
						throw new Error(
							"Transcription did not expose a gateway generation id",
						);
					}

					return captured;
				});
			} catch (error) {
				captureFailure = { error };
			}

			// Settlement is independent of generation-ref capture. Its durable raw
			// usage makes the transcript replayable and charges the authoritative
			// duration even if ref persistence exhausted all retries.
			try {
				await retryMeteringWrite(() =>
					this.meteringService.settle(reservation.event.id, {
						finalCredits,
						model: env.AI_TRANSCRIPTION_MODEL,
						pricing: "direct",
						pricingSnapshot: {
							billableDurationSeconds,
							creditsPerMinute: TRANSCRIPTION_CREDITS_PER_MINUTE,
							durationSeconds: billableDurationSeconds,
							durationSource:
								providerDurationSeconds === null ? "container" : "provider",
							localDurationSeconds: durationSeconds,
							maxDurationSeconds: TRANSCRIPTION_MAX_DURATION_SECONDS,
							minimumCredits: 1,
							mode: "per_minute",
							providerDurationSeconds,
						},
						rawUsage: {
							billableDurationSeconds,
							durationSeconds,
							localDurationSeconds: durationSeconds,
							providerDurationSeconds,
							...(response
								? { transcriptionResponse: response }
								: { rejectedReason: "provider_duration_exceeds_limit" }),
						},
					}),
				);
			} catch (error) {
				settlementFailure = { error };
			}

			// A captured ref lets stale-reservation recovery finish a failed
			// settlement. A successful settlement prevents recovery from refunding a
			// provider call whose ref could not be persisted.
			if (settlementFailure) {
				throw settlementFailure.error;
			}

			if (captureFailure) {
				throw captureFailure.error;
			}
		}

		if (providerDurationExceedsLimit) {
			throw audioDurationTooLong("provider");
		}

		if (!response) {
			throw new Error("Transcription response was not constructed");
		}

		return response;
	}

	// Shared config check for this service.
	private assertGatewayConfigured() {
		if (!env.AI_GATEWAY_API_KEY) {
			throw new AiGatewayNotConfiguredError();
		}
	}

	private async captureProviderFailureSafely(
		eventId: string,
		error: unknown,
	): Promise<void> {
		const capture = gatewayGenerationCaptureFromError(error);

		if (!capture) {
			return;
		}

		try {
			await retryMeteringWrite(async () => {
				const generationRef = await this.meteringService.captureGeneration(
					eventId,
					capture,
				);

				if (!generationRef) {
					throw new Error(
						"Transcription gateway error did not expose a valid generation id",
					);
				}

				return generationRef;
			});
		} catch (captureError) {
			this.logger.error(
				`Failed to capture transcription gateway error for ${eventId}`,
				captureError instanceof Error
					? captureError.stack
					: String(captureError),
			);
		}
	}

	private async refundProviderFailureSafely(eventId: string): Promise<void> {
		try {
			// MeteringService leaves the hold reserved when the capture above made
			// provider spend durable, so recovery can reconcile it authoritatively.
			await this.meteringService.refund(
				eventId,
				"transcription_provider_failed",
			);
		} catch (refundError) {
			this.logger.error(
				`Failed to refund transcription reservation ${eventId}`,
				refundError instanceof Error ? refundError.stack : String(refundError),
			);
		}
	}
}

function replayExistingTranscription(
	event: AiUsageEvent,
	expected: { credits: number; model: string; operationId: string },
): TranscriptionResponse {
	if (
		event.operation !== "transcription" ||
		event.attemptRef !== expected.operationId ||
		event.reservedCredits !== expected.credits ||
		event.model !== expected.model ||
		event.parentEventId !== null ||
		event.chatId !== null ||
		event.messageId !== null ||
		event.provider !== null
	) {
		throw transcriptionReplayConflict(
			"This transcription operation id belongs to a different request",
		);
	}

	if (event.status === "settled" || event.status === "reconciled") {
		const response = storedTranscriptionResponse(event.rawUsage);

		if (response) {
			return response;
		}
	}

	throw transcriptionReplayConflict(
		event.status === "reserved"
			? "This transcription operation is already in progress"
			: "This transcription operation cannot execute again",
	);
}

function storedTranscriptionResponse(
	rawUsage: unknown,
): TranscriptionResponse | null {
	if (!isRecord(rawUsage)) {
		return null;
	}

	const direct = transcriptionResponseSchema.safeParse(
		rawUsage.transcriptionResponse,
	);

	if (direct.success) {
		return direct.data;
	}

	// Reconciliation preserves the original settlement payload under this key.
	// Current reconciled rows also spread its fields at the top level, but the
	// fallback keeps replay robust if that representation changes later.
	if (isRecord(rawUsage.settlementRawUsage)) {
		const settlement = transcriptionResponseSchema.safeParse(
			rawUsage.settlementRawUsage.transcriptionResponse,
		);

		if (settlement.success) {
			return settlement.data;
		}
	}

	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function transcriptionReplayConflict(message: string): ConflictException {
	return new ConflictException({
		code: "TRANSCRIPTION_OPERATION_REPLAYED",
		message,
	});
}

function validProviderDurationSeconds(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: null;
}

function audioDurationTooLong(
	durationSource: "container" | "provider",
): BadRequestException {
	return new BadRequestException({
		code: "AUDIO_DURATION_TOO_LONG",
		details: {
			durationSource,
			maxDurationSec: TRANSCRIPTION_MAX_DURATION_SECONDS,
		},
		message: `Audio must be ${TRANSCRIPTION_MAX_DURATION_SECONDS} seconds or shorter`,
	});
}

async function retryMeteringWrite<T>(write: () => Promise<T>): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt < METERING_WRITE_ATTEMPTS; attempt += 1) {
		try {
			return await write();
		} catch (error) {
			lastError = error;

			if (attempt < METERING_WRITE_ATTEMPTS - 1) {
				await delay(50 * 2 ** attempt);
			}
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Metering persistence failed");
}

// Clean up the client-provided content type before sending it to the gateway.
function normalizeAudioMediaType(mimeType: string): string {
	// Browsers often add codec details ("audio/webm;codecs=opus") — drop them.
	const bareType = mimeType.split(";")[0]?.trim().toLowerCase() ?? mimeType;

	// Common aliases for AAC-in-MP4 audio map to the one name the gateway knows.
	if (
		bareType === "audio/m4a" ||
		bareType === "audio/x-m4a" ||
		bareType === "audio/aac"
	) {
		return "audio/mp4";
	}

	return bareType;
}
