/**
 * product_video — queues one deterministic five-second commercial from an
 * authorized product image.
 *
 * Public reachability is not authorization. User uploads must be present in
 * the validated transcript allowlist, while generated images are resolved by
 * exact URL against a succeeded attempt in this project.
 */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type ImageToVideoAspect,
	type ImageToVideoSourceMediaType,
	type ProductVideoInput,
	type ProductVideoOutput,
	productVideoInputSchema,
	productVideoOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";

import {
	isR2Configured,
	isUserUploadUrl,
} from "../../../../infrastructure/storage/r2";
// Type-only import: importing the task value would pull the Trigger worker
// (and its database pool) into the Nest API process.
import type { productVideoTask } from "../../../../trigger/product-video.task";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import type { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
import { prepareVideoSourceImage } from "../../../media-generations/application/services/prepare-video-source-image";
import {
	createVideoBilling,
	type VideoBilling,
} from "../../../media-generations/application/services/video-billing";
import { buildProductVideoPrompt } from "../../../media-generations/domain/product-video-prompts";
import { VIDEO_PRODUCT_ENGINE_MODEL } from "../../../media-generations/domain/video-quality-models";
import type { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import { assertFixedOperationProviderExecutionAllowed } from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { AvailableImage } from "./animate-image.tool";

const logger = new Logger("product-video");
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type ProductVideoToolDeps = {
	availableImages: readonly AvailableImage[];
	chatId: string;
	imageGenerationsRepository: ImageGenerationsRepository;
	mediaGenerationsRepository: MediaGenerationsRepository;
	meteringService: MeteringService;
	parentEventId?: string;
	projectId: string;
	requestKeySeed?: string;
	/** Pays for the render: the org pool in an org workspace. */
	subject: MeteringSubject;
	userId: string;
};

type AuthorizedProductImage = {
	mediaType: ImageToVideoSourceMediaType;
	road: "attachment" | "generated";
	url: string;
};

export function createProductVideoTool(
	deps: ProductVideoToolDeps,
): Tool<ProductVideoInput, ProductVideoOutput> {
	const billing = createVideoBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: deps.meteringService,
	});
	// The tool instance is request-scoped. The ordinal separates two clips in
	// one turn while a transport retry replays the same first ordinal.
	let clipOrdinal = 0;

	return tool({
		description:
			"Create one five-second commercial video from exactly one product " +
			"photo attached by this user or generated in this project. Choose one " +
			"look: orbit, hero, or lifestyle. Call exactly once per requested clip " +
			"after warning that tiny text, fine print, and logos can drift. The " +
			"server uses a deterministic prompt and the result card shows progress.",
		inputSchema: productVideoInputSchema,
		outputSchema: productVideoOutputSchema,
		execute: async (input, options): Promise<ProductVideoOutput> => {
			const clip = clipOrdinal++;

			if (
				!env.AI_GATEWAY_API_KEY ||
				!env.R2_PUBLIC_BASE_URL ||
				!isR2Configured() ||
				!env.TRIGGER_SECRET_KEY
			) {
				return {
					message:
						"Product video generation is not configured on this server yet. " +
						"Tell the user honestly that AI gateway, storage, and Trigger.dev " +
						"credentials are required.",
					status: "unavailable",
				};
			}

			let source: AuthorizedProductImage | null;

			try {
				source = await authorizeProductImage(deps, input);
			} catch (error) {
				logger.error(
					"Resolving the product image source failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The product image could not be checked on the server. Tell the " +
						"user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (!source) {
				return {
					message:
						"That image is not an eligible product photo from this conversation " +
						"and project. Ask the user for one attached JPEG, PNG, or WebP, or " +
						"use an image Wandit generated in this chat. Do not claim that a " +
						"video was queued.",
					status: "unavailable",
				};
			}

			let prepared: Awaited<ReturnType<typeof prepareVideoSourceImage>>;

			try {
				prepared = await prepareVideoSourceImage({
					modelId: VIDEO_PRODUCT_ENGINE_MODEL,
					sourceUrl: source.url,
					...(source.road === "attachment" ? { userId: deps.userId } : {}),
				});
			} catch (error) {
				logger.error(
					"Preparing the product video source failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The product image could not be prepared on the server. Tell the " +
						"user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (prepared.status === "rejected") {
				return {
					message:
						`${prepared.userMessage} Tell the user this exact reason plainly ` +
						"and ask for a different product photo.",
					status: "unavailable",
				};
			}

			if (!isSeedanceSourceMediaType(prepared.mediaType)) {
				return {
					message:
						"The prepared product image has an unsupported format. Tell the " +
						"user plainly and ask for a different JPEG or PNG photo.",
					status: "unavailable",
				};
			}

			let attempt: {
				created: boolean;
				id: string;
				status: "queued" | "generating" | "succeeded" | "failed";
			};

			try {
				// Model-authored display/fact fields are excluded: the first persisted
				// snapshot wins across a transport replay. The prepared URL and preset
				// are the stable source/direction choices for this operation.
				const requestKey = createHash("sha256")
					.update(
						JSON.stringify({
							clip,
							preset: input.preset,
							request: deps.requestKeySeed ?? options.toolCallId,
							sourceImageUrl: prepared.url,
						}),
					)
					.digest("hex");

				attempt = await deps.mediaGenerationsRepository.insertAttempt({
					aspect: nearestDurableAspect(prepared.width, prepared.height),
					chainDepth: 0,
					chatId: deps.chatId,
					durationSeconds: 5,
					kind: "video-product",
					model: VIDEO_PRODUCT_ENGINE_MODEL,
					motion: null,
					projectId: deps.projectId,
					prompt: buildProductVideoPrompt({
						preset: input.preset,
						productDetails: input.productDetails,
						productName: input.productName,
					}),
					quality: null,
					requestKey,
					sourceAttemptId: null,
					sourceImageUrl: prepared.url,
					sourceMediaType: prepared.mediaType,
					sourceVideoMediaType: null,
					sourceVideoUrl: null,
					talking: null,
					title: input.title,
					voiceover: null,
				});
			} catch (error) {
				logger.error(
					"Creating the product video attempt failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The product video request could not be saved on the server. Tell " +
						"the user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "failed") {
				await refundReservation(deps, billing, attempt.id);

				return {
					message:
						"This exact product video request already failed. Tell the user " +
						"and wait for a new request before retrying.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "queued") {
				return {
					attemptId: attempt.id,
					message:
						"This product video request was already accepted. Its existing " +
						"progress card appears in the conversation.",
					status: "queued",
				};
			}

			if (
				!attempt.created &&
				(attempt.status === "generating" || attempt.status === "succeeded")
			) {
				return {
					attemptId: attempt.id,
					message:
						"This product video request was already accepted. Its existing " +
						"progress or result card appears in the conversation.",
					status: "queued",
				};
			}

			const reservation = await billing.reserve(
				deps.subject,
				attempt.id,
				1,
				deps.parentEventId,
				undefined,
				{
					audio: false,
					durationSeconds: 5,
					kind: "video-product",
					modelId: VIDEO_PRODUCT_ENGINE_MODEL,
				},
			);

			assertFixedOperationProviderExecutionAllowed(reservation);

			let handle: Awaited<ReturnType<typeof tasks.trigger>>;

			try {
				handle = await triggerProductVideoTask({
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
					`Trigger.dev did not confirm product video ${attempt.id}: ${message}`,
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
									"Trigger.dev rejected the product video request. Tell the " +
									"user it was not queued and offer to retry after the " +
									"server configuration is fixed.",
								status: "unavailable",
							};
						}
					} catch (settlementError) {
						logger.error(
							`Closing rejected product video ${attempt.id} failed`,
							settlementError instanceof Error
								? settlementError.stack
								: String(settlementError),
						);
					}
				}

				// Trigger may accept a request even when the response is lost. Keep an
				// ambiguous handoff queued for the stale-attempt reconciler.
				return {
					attemptId: attempt.id,
					message:
						"The product video request is saved, but Trigger.dev did not " +
						"confirm the handoff yet. Its card will keep checking, and the " +
						"same request can be retried safely.",
					status: "queued",
				};
			}

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

			const realtime = await mintRealtimeHandle(handle.id);

			return {
				attemptId: attempt.id,
				...(realtime ? { realtime } : {}),
				message:
					"Queued: the five-second product video is rendering in the " +
					"background. Progress and the playable result appear here in the " +
					"conversation.",
				status: "queued",
			};
		},
	});
}

async function authorizeProductImage(
	deps: Pick<
		ProductVideoToolDeps,
		"availableImages" | "imageGenerationsRepository" | "projectId" | "userId"
	>,
	input: ProductVideoInput,
): Promise<AuthorizedProductImage | null> {
	if (isUserUploadUrl(input.image.url, deps.userId)) {
		const attachment = deps.availableImages.find(
			(image) =>
				image.url === input.image.url &&
				image.mediaType === input.image.mediaType,
		);

		return attachment ? { ...attachment, road: "attachment" } : null;
	}

	const generated =
		await deps.imageGenerationsRepository.findSucceededImageByUrlForProject(
			deps.projectId,
			input.image.url,
		);

	if (!generated || !isSupportedProductImageMediaType(generated.mediaType)) {
		return null;
	}

	return {
		mediaType: generated.mediaType,
		road: "generated",
		url: generated.url,
	};
}

function isSupportedProductImageMediaType(
	mediaType: string,
): mediaType is ImageToVideoSourceMediaType {
	return (
		mediaType === "image/jpeg" ||
		mediaType === "image/png" ||
		mediaType === "image/webp"
	);
}

function isSeedanceSourceMediaType(
	mediaType: string,
): mediaType is "image/jpeg" | "image/png" {
	return mediaType === "image/jpeg" || mediaType === "image/png";
}

/**
 * The durable schema predates adaptive provider aspect and requires one of
 * three display buckets. Keep the provider request adaptive; this value is
 * only the closest card/layout descriptor for the prepared source.
 */
function nearestDurableAspect(
	width: number,
	height: number,
): ImageToVideoAspect {
	const measured = width / height;
	const candidates = [
		{ aspect: "16:9" as const, ratio: 16 / 9 },
		{ aspect: "1:1" as const, ratio: 1 },
		{ aspect: "9:16" as const, ratio: 9 / 16 },
	];

	return candidates.reduce((nearest, candidate) =>
		Math.abs(Math.log(measured / candidate.ratio)) <
		Math.abs(Math.log(measured / nearest.ratio))
			? candidate
			: nearest,
	).aspect;
}

async function mintRealtimeHandle(
	runId: string,
): Promise<ProductVideoOutput["realtime"]> {
	try {
		const publicAccessToken = await auth.createPublicToken({
			expirationTime: "2h",
			scopes: { read: { runs: [runId] } },
		});

		return { publicAccessToken, runId };
	} catch (error) {
		logger.warn(
			`Realtime token minting failed for run ${runId} — the product video card will rely on polling: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);

		return undefined;
	}
}

async function triggerProductVideoTask(payload: {
	attemptId: string;
	billingMode: "enforce" | "off";
	organizationId: string | null;
	parentEventId?: string;
	projectId: string;
	userId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`video-product:${payload.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof productVideoTask>(
				"product-video",
				payload,
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`media-attempt:${payload.attemptId}`,
						`project:${payload.projectId}`,
					],
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
	deps: Pick<ProductVideoToolDeps, "subject">,
	billing: VideoBilling,
	attemptId: string,
): Promise<void> {
	try {
		await billing.refund(deps.subject, attemptId, "video-product");
	} catch (error) {
		logger.error(
			`Refunding product video reservation ${attemptId} failed`,
			error instanceof Error ? error.stack : String(error),
		);
	}
}

export type ProductVideoTool = ReturnType<typeof createProductVideoTool>;

export const productVideoToolSchemaOnly: Tool<
	ProductVideoInput,
	ProductVideoOutput
> = tool({
	inputSchema: productVideoInputSchema,
	outputSchema: productVideoOutputSchema,
});
