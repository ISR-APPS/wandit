/**
 * animate_image — queues one durable five-second image-to-video job.
 *
 * The model can describe motion, but it cannot choose an arbitrary source
 * URL. The server closes over the exact image file parts in this transcript
 * and requires the selected URL/media type to match one of them.
 */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Logger } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type AnimateImageInput,
	type AnimateImageOutput,
	animateImageInputSchema,
	animateImageOutputSchema,
	type ImageToVideoSourceMediaType,
	imageToVideoSourceMediaTypeSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";

import {
	isR2Configured,
	isUserUploadUrl,
} from "../../../../infrastructure/storage/r2";
// Type-only import: importing the task value would pull the Trigger worker
// (and its database pool) into the Nest API process.
import type { animateImageTask } from "../../../../trigger/animate-image.task";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	createImageAnimationBilling,
	type ImageAnimationBilling,
} from "../../../media-generations/application/services/image-animation-billing";
import { prepareVideoSourceImage } from "../../../media-generations/application/services/prepare-video-source-image";
import { resolveVideoGenerationPlan } from "../../../media-generations/domain/video-quality-models";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import { assertFixedOperationProviderExecutionAllowed } from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";

const logger = new Logger("animate-image");
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type AvailableImage = {
	mediaType: ImageToVideoSourceMediaType;
	url: string;
};

export type AnimateImageToolDeps = {
	availableImages: readonly AvailableImage[];
	chatId: string;
	mediaGenerationsRepository: MediaGenerationsRepository;
	meteringService: MeteringService;
	parentEventId?: string;
	projectId: string;
	requireSelectedSource?: boolean;
	requestKeySeed?: string;
	selectedSourceImage?: AvailableImage;
	/** Pays for the animation: the org pool in an org workspace. */
	subject: MeteringSubject;
	userId: string;
};

export function createAnimateImageTool(
	deps: AnimateImageToolDeps,
): Tool<AnimateImageInput, AnimateImageOutput> {
	const billing = createImageAnimationBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: deps.meteringService,
	});
	// Per-request clip ordinal: the tool instance is built per chat request, so
	// a transport-retried turn replays the same ordinals (0, 1, …) and dedupes
	// onto the existing attempts, while a genuine second clip in the same turn
	// still gets its own requestKey.
	let clipOrdinal = 0;

	return tool({
		description:
			"Animate exactly one uploaded JPEG, PNG, or WebP into a " +
			"five-second video. This is image-to-video only: sourceImageUrl and " +
			"sourceMediaType MUST exactly match an image attached by this user " +
			"in the conversation. The platform automatically fixes format, size, " +
			"and aspect where possible. Files over 25 MB and images shaped beyond " +
			"1:4–4:1 are refused; very small photos can animate softly. Call once " +
			"per requested clip. The result card shows progress and plays the " +
			"finished video.",
		inputSchema: animateImageInputSchema,
		outputSchema: animateImageOutputSchema,
		execute: async (input, options): Promise<AnimateImageOutput> => {
			const clip = clipOrdinal++;
			if (
				!env.AI_GATEWAY_API_KEY ||
				!env.R2_PUBLIC_BASE_URL ||
				!isR2Configured() ||
				!env.TRIGGER_SECRET_KEY
			) {
				return {
					message:
						"Image animation is not configured on this server yet. Tell " +
						"the user honestly that AI gateway, storage, and Trigger.dev " +
						"credentials are required.",
					status: "unavailable",
				};
			}

			const plan = resolveVideoGenerationPlan({
				durationSeconds: 5,
				kind: "i2v",
				multiShot: false,
				narration: false,
				quality: input.quality,
				talking: input.talking,
			});

			const attached = deps.availableImages.find(
				(image) =>
					image.url === input.sourceImageUrl &&
					image.mediaType === input.sourceMediaType,
			);

			const selectedSourceMismatch = deps.selectedSourceImage
				? attached?.url !== deps.selectedSourceImage.url ||
					attached?.mediaType !== deps.selectedSourceImage.mediaType
				: false;
			const requiredSourceMissing =
				deps.requireSelectedSource && !deps.selectedSourceImage;

			if (
				!attached ||
				requiredSourceMissing ||
				selectedSourceMismatch ||
				!isUserUploadUrl(attached.url, deps.userId)
			) {
				return {
					message:
						"The source is not an eligible image attached by this user. " +
						"Only a USER-uploaded JPEG, PNG, or WebP can be animated — " +
						"generated assets are not valid sources. Ask for one " +
						"attachment only when the user never sent an eligible photo.",
					status: "unavailable",
				};
			}

			let prepared: Awaited<ReturnType<typeof prepareVideoSourceImage>>;

			try {
				prepared = await prepareVideoSourceImage({
					modelId: plan.modelId,
					sourceUrl: attached.url,
					userId: deps.userId,
				});
			} catch (error) {
				logger.error(
					"Preparing the image animation source failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The video request could not be saved on the server. Tell the " +
						"user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (prepared.status === "rejected") {
				return {
					message:
						`${prepared.userMessage} Tell the user this exact reason plainly ` +
						"and ask for a different photo.",
					status: "unavailable",
				};
			}

			const preparedMediaType = imageToVideoSourceMediaTypeSchema.safeParse(
				prepared.mediaType,
			);

			if (!preparedMediaType.success) {
				return {
					message:
						"The prepared source image has an unsupported format. Tell the user " +
						"plainly and ask for a different JPEG, PNG, or WebP photo.",
					status: "unavailable",
				};
			}

			let attempt: {
				created: boolean;
				id: string;
				status: "queued" | "generating" | "succeeded" | "failed";
			};

			try {
				// Only transport-stable fields enter the hash. The model-authored
				// prompt/quality/talking fields can be recomposed on a retried turn
				// and must not defeat videoSubmissionId dedup; the first persisted
				// snapshot decides what renders. The clip ordinal keeps two different
				// clips requested in ONE turn from colliding.
				const requestKey = createHash("sha256")
					.update(
						JSON.stringify({
							aspect: input.aspect,
							clip,
							motion: input.motion,
							request: deps.requestKeySeed ?? options.toolCallId,
							sourceImageUrl: prepared.url,
							sourceMediaType: preparedMediaType.data,
						}),
					)
					.digest("hex");

				attempt = await deps.mediaGenerationsRepository.insertAttempt({
					aspect: input.aspect,
					chatId: deps.chatId,
					model: plan.modelId,
					motion: input.motion,
					projectId: deps.projectId,
					prompt: input.prompt.trim(),
					quality: plan.quality,
					requestKey,
					sourceImageUrl: prepared.url,
					sourceMediaType: preparedMediaType.data,
					talking: input.talking,
				});
			} catch (error) {
				logger.error(
					"Creating the image animation attempt failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The video request could not be saved on the server. Tell the " +
						"user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "failed") {
				await refundReservation(deps, billing, attempt.id);

				return {
					message:
						"This exact image-animation request already failed. Tell the " +
						"user and wait for a new request before retrying.",
					status: "unavailable",
				};
			}

			if (
				!attempt.created &&
				(attempt.status === "generating" || attempt.status === "succeeded")
			) {
				return {
					attemptId: attempt.id,
					message:
						"This image-animation request was already accepted. Its " +
						"existing progress or result card appears in the conversation.",
					status: "queued",
				};
			}

			const reservation = await billing.reserve(
				deps.subject,
				attempt.id,
				deps.parentEventId,
			);

			assertFixedOperationProviderExecutionAllowed(reservation);

			let handle: Awaited<ReturnType<typeof tasks.trigger>>;

			try {
				handle = await triggerAnimateImageTask({
					attemptId: attempt.id,
					billingMode: reservation.eventId ? "enforce" : "off",
					organizationId: deps.subject.organizationId ?? null,
					...(deps.parentEventId ? { parentEventId: deps.parentEventId } : {}),
					projectId: deps.projectId,
					userId: deps.userId,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				logger.error(
					`Trigger.dev did not confirm image animation ${attempt.id}: ${message}`,
				);

				if (isDefinitiveTriggerRejection(error)) {
					try {
						const closed =
							await deps.mediaGenerationsRepository.markAttemptFailed(
								attempt.id,
								"The background generator rejected this request. Please try again.",
								deps.userId,
							);

						if (closed) {
							await refundReservation(deps, billing, attempt.id);

							return {
								message:
									"Trigger.dev rejected the image-animation request. Tell " +
									"the user it was not queued and offer to retry after the " +
									"server configuration is fixed.",
								status: "unavailable",
							};
						}
					} catch (settlementError) {
						logger.error(
							`Closing rejected image animation ${attempt.id} failed`,
							settlementError instanceof Error
								? settlementError.stack
								: String(settlementError),
						);
					}
				}

				// A Trigger request can be accepted even when its HTTP response is
				// lost. The attempt-based idempotency key makes a retry safe, so
				// never close a still-queued row merely because this client did not
				// receive the handle. Stale queued attempts are reconciled later.
				return {
					attemptId: attempt.id,
					message:
						"The image-animation request is saved, but Trigger.dev did not " +
						"confirm the handoff yet. Its card will keep checking, and the " +
						"same request can be retried safely.",
					status: "queued",
				};
			}

			// The task can claim the row immediately after tasks.trigger resolves.
			// Persisting the diagnostic run id is best-effort; the task writes the
			// same id as part of its atomic queued -> generating claim.
			try {
				await deps.mediaGenerationsRepository.markAttemptTriggered(
					attempt.id,
					handle.id,
				);
			} catch (error) {
				logger.warn(
					`Could not persist Trigger.dev run id for ${attempt.id}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}

			return {
				attemptId: attempt.id,
				message:
					"Queued: the image is being animated into a five-second video. " +
					"Progress and the playable result appear here in the conversation.",
				status: "queued",
			};
		},
	});
}

async function triggerAnimateImageTask(payload: {
	attemptId: string;
	billingMode: "enforce" | "off";
	organizationId: string | null;
	parentEventId?: string;
	projectId: string;
	userId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`image-animation:${payload.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof animateImageTask>(
				"animate-image",
				payload,
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`media-attempt:${payload.attemptId}`,
						`project:${payload.projectId}`,
					],
					// If Trigger cannot start the run within this window, its own
					// queue expires it before the DB's 30-minute queued-attempt
					// reconciler closes the card.
					ttl: "25m",
				},
			);
		} catch (error) {
			lastError = error;

			if (isDefinitiveTriggerRejection(error)) {
				break;
			}

			if (attempt < TRIGGER_HANDOFF_ATTEMPTS - 1) {
				await delay(100 * 2 ** attempt);
			}
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Trigger.dev handoff failed");
}

function isDefinitiveTriggerRejection(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const candidate = error as { name?: unknown; status?: unknown };

	return (
		candidate.name === "TriggerApiError" &&
		(candidate.status === 400 ||
			candidate.status === 401 ||
			candidate.status === 403 ||
			candidate.status === 404 ||
			candidate.status === 422)
	);
}

async function refundReservation(
	deps: AnimateImageToolDeps,
	billing: ImageAnimationBilling,
	attemptId: string,
): Promise<void> {
	try {
		await billing.refund(deps.subject, attemptId);
	} catch (error) {
		logger.error(
			`Refunding image animation reservation ${attemptId} failed`,
			error instanceof Error ? error.stack : String(error),
		);
	}
}

export type AnimateImageTool = ReturnType<typeof createAnimateImageTool>;

export const animateImageToolSchemaOnly: Tool<
	AnimateImageInput,
	AnimateImageOutput
> = tool({
	inputSchema: animateImageInputSchema,
	outputSchema: animateImageOutputSchema,
});
