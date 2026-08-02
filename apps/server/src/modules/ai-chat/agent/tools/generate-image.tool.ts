/**
 * generate_image — queues one image generation (1-4 images), optionally
 * placing one result into a current page image when it finishes.
 *
 * Two paths share one attempt: pure text-to-image, and EDIT mode when the
 * model passes user-attached source images (product photo, logo) so outputs
 * stay faithful to the real product. The model can describe the shot, but it
 * cannot choose arbitrary source URLs: every source must exactly match an
 * image this user attached in the conversation.
 */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Logger } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type GenerateImageInput,
	type GenerateImageOutput,
	generateImageInputSchema,
	generateImageOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { type Tool, tool } from "ai";
import * as cheerio from "cheerio";

import {
	getPageHtml,
	isR2Configured,
	isUserUploadUrl,
} from "../../../../infrastructure/storage/r2";
// Type-only import: importing the task value would pull the Trigger worker
// (and its database pool) into the Nest API process.
import type { generateImageTask } from "../../../../trigger/generate-image.task";
import type { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import type { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
import { stampHtml } from "../../../pages/domain/stamp";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import type { AvailableImage } from "./animate-image.tool";

const logger = new Logger("generate-image");
const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type GenerateImageToolDeps = {
	availableImages: readonly AvailableImage[];
	chatId: string;
	generationPolicyService: GenerationPolicyService;
	imageGenerationsRepository: ImageGenerationsRepository;
	pagesRepository: PagesRepository;
	projectId: string;
	// Composer quality tier, snapshotted for later model swapping — the
	// generator does not read it yet.
	quality?: string;
	requestKeySeed?: string;
	userId: string;
};

export function createGenerateImageTool(
	deps: GenerateImageToolDeps,
): Tool<GenerateImageInput, GenerateImageOutput> {
	return tool({
		description:
			"Queue an image generation (1-4 images) that runs in the background; " +
			"results appear in the conversation and in the user's Assets tab. " +
			"When replacing an existing page image, pass placement with that " +
			"image's verified data-wid; the selected generated result is applied " +
			"to the page automatically when ready. Do not ask for an attachment " +
			"just to place a generated image. To feature the user's REAL product " +
			"or logo faithfully, pass the " +
			"exact URLs of images they attached as sourceImageUrls — the " +
			"generator edits/stays faithful to them. Without sources it " +
			"generates from the prompt alone. Call once per requested set.",
		inputSchema: generateImageInputSchema,
		outputSchema: generateImageOutputSchema,
		execute: async (input, options): Promise<GenerateImageOutput> => {
			if (
				!env.AI_GATEWAY_API_KEY ||
				!env.AI_IMAGE_MODEL ||
				!env.R2_PUBLIC_BASE_URL ||
				!isR2Configured() ||
				!env.TRIGGER_SECRET_KEY
			) {
				return {
					message:
						"Standalone image generation is not configured on this server " +
						"yet. Tell the user honestly that image model, storage, and " +
						"Trigger.dev credentials are required.",
					status: "unavailable",
				};
			}

			const sourceImageUrls = input.sourceImageUrls ?? [];

			if (sourceImageUrls.length > 0 && !env.AI_IMAGE_EDIT_MODEL) {
				return {
					message:
						"Editing user photos is not configured on this server " +
						"(AI_IMAGE_EDIT_MODEL is unset). Either generate without " +
						"source images or tell the user photo-faithful generation " +
						"is not available yet.",
					status: "unavailable",
				};
			}

			for (const url of sourceImageUrls) {
				const attached = deps.availableImages.find(
					(image) => image.url === url,
				);

				if (!attached || !isUserUploadUrl(attached.url, deps.userId)) {
					return {
						message:
							"A source is not an eligible image attached by this user. " +
							"Every sourceImageUrl must exactly match one of their " +
							"JPEG, PNG, or WebP attachments. Ask for the photo first.",
						status: "unavailable",
					};
				}
			}

			if (input.placement) {
				if (input.placement.imageIndex > input.count) {
					return {
						message:
							`Placement requests generated image ${input.placement.imageIndex}, ` +
							`but this request only generates ${input.count}. Choose an imageIndex ` +
							"within the requested count.",
						status: "unavailable",
					};
				}

				const rejection = await validatePlacementTarget(
					deps,
					input.placement.wid,
				);

				if (rejection) {
					return {
						message: rejection,
						status: "unavailable",
					};
				}
			}

			try {
				await deps.generationPolicyService.assertCanGenerate(
					deps.userId,
					"imageGeneration",
				);
			} catch {
				return {
					message:
						"The user needs an active subscription or 5 credits for " +
						"image generation. Explain that clearly and do not claim the " +
						"images were queued.",
					status: "unavailable",
				};
			}

			let attempt: {
				created: boolean;
				id: string;
				status: "queued" | "generating" | "succeeded" | "failed";
			};

			try {
				const requestKey = createHash("sha256")
					.update(
						JSON.stringify({
							aspect: input.aspect,
							count: input.count,
							prompt: input.prompt,
							placement: input.placement,
							request: deps.requestKeySeed ?? options.toolCallId,
							sourceImageUrls,
						}),
					)
					.digest("hex");

				const spec = {
					...(deps.quality ? { quality: deps.quality } : {}),
					...(input.placement
						? {
								placement: {
									...input.placement,
									status: "pending" as const,
								},
							}
						: {}),
				};

				attempt = await deps.imageGenerationsRepository.insertAttempt({
					aspect: input.aspect,
					chatId: deps.chatId,
					count: input.count,
					projectId: deps.projectId,
					prompt: input.prompt.trim(),
					requestKey,
					sourceImageUrls,
					spec: Object.keys(spec).length > 0 ? spec : undefined,
					title: input.title.trim(),
				});
			} catch (error) {
				logger.error(
					"Creating the image generation attempt failed",
					error instanceof Error ? error.stack : String(error),
				);

				return {
					message:
						"The image request could not be saved on the server. Tell " +
						"the user and offer to retry in a moment.",
					status: "unavailable",
				};
			}

			if (!attempt.created && attempt.status === "failed") {
				await refundReservation(deps, attempt.id);

				return {
					message:
						"This exact image request already failed. Tell the user and " +
						"wait for a new request before retrying.",
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
						"This image request was already accepted. Its existing " +
						"progress or result card appears in the conversation.",
					status: "queued",
				};
			}

			try {
				const handle = await triggerGenerateImageTask({
					attemptId: attempt.id,
					projectId: deps.projectId,
					userId: deps.userId,
				});

				try {
					await deps.imageGenerationsRepository.markAttemptTriggered(
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
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				logger.error(
					`Trigger.dev did not confirm image generation ${attempt.id}: ${message}`,
				);

				if (isDefinitiveTriggerRejection(error)) {
					try {
						const closed =
							await deps.imageGenerationsRepository.markAttemptFailed(
								attempt.id,
								"The background generator rejected this request. Please try again.",
								deps.userId,
								"trigger_rejected",
							);

						if (closed) {
							await refundReservation(deps, attempt.id);

							return {
								message:
									"Trigger.dev rejected the image request. Tell the user " +
									"it was not queued and offer to retry after the server " +
									"configuration is fixed.",
								status: "unavailable",
							};
						}
					} catch (settlementError) {
						logger.error(
							`Closing rejected image generation ${attempt.id} failed`,
							settlementError instanceof Error
								? settlementError.stack
								: String(settlementError),
						);
					}
				}

				// The request may have been accepted even when the HTTP response was
				// lost; the attempt-based idempotency key makes retries safe.
				return {
					attemptId: attempt.id,
					message:
						"The image request is saved, but Trigger.dev did not confirm " +
						"the handoff yet. Its card will keep checking, and the same " +
						"request can be retried safely.",
					status: "queued",
				};
			}

			return {
				attemptId: attempt.id,
				message: input.placement
					? "Queued: the images are being generated in the background, and " +
						"the selected result will replace the page image when ready. " +
						"Progress and the results appear here and in the Assets tab."
					: "Queued: the images are being generated in the background. " +
						"Progress and the results appear here in the conversation and " +
						"in the Assets tab.",
				status: "queued",
			};
		},
	});
}

async function validatePlacementTarget(
	deps: Pick<GenerateImageToolDeps, "pagesRepository" | "projectId">,
	wid: string,
): Promise<string | null> {
	try {
		const page = await deps.pagesRepository.findActivePageByProjectUnchecked(
			deps.projectId,
		);

		if (!page?.version) {
			return "The page image could not be targeted because no active page exists. Inspect the current page before trying another edit.";
		}

		const html = await getPageHtml(page.version.r2Key);

		if (html === null) {
			return "The current page HTML could not be loaded, so the image placement was not queued. Re-read the page and try again.";
		}

		const raw = cheerio.load(html);
		let matches = raw(`[data-wid="${wid}"]`);

		// Current versions are stored stamped, but legacy versions may gain a
		// deterministic wid only in the preview/read pipeline. Preserve raw
		// duplicate detection, then fall back to that canonical stamped shape.
		if (matches.length === 0) {
			const stamped = cheerio.load(stampHtml(html));
			matches = stamped(`[data-wid="${wid}"]`);
		}

		if (matches.length === 0) {
			return `No element with data-wid="${wid}" exists on the current page. Re-read the target and fall back to another edit if needed.`;
		}

		if (matches.length !== 1) {
			return `The data-wid "${wid}" is not unique on the current page. Re-read the target before trying another edit.`;
		}

		if (!matches.is("img")) {
			return `The element with data-wid="${wid}" is not an <img>, so image placement was not queued. Use the appropriate page edit instead.`;
		}

		return null;
	} catch {
		return "The current page could not be loaded, so the image placement was not queued. Re-read the page and try again.";
	}
}

async function triggerGenerateImageTask(payload: {
	attemptId: string;
	projectId: string;
	userId: string;
}): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		`image-generation:${payload.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof generateImageTask>(
				"generate-image",
				payload,
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`image-attempt:${payload.attemptId}`,
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
	deps: GenerateImageToolDeps,
	attemptId: string,
): Promise<void> {
	try {
		await deps.generationPolicyService.refundGenerationReservation(
			deps.userId,
			attemptId,
		);
	} catch (error) {
		logger.error(
			`Refunding image generation reservation ${attemptId} failed`,
			error instanceof Error ? error.stack : String(error),
		);
	}
}

export type GenerateImageTool = ReturnType<typeof createGenerateImageTool>;

export const generateImageToolSchemaOnly: Tool<
	GenerateImageInput,
	GenerateImageOutput
> = tool({
	inputSchema: generateImageInputSchema,
	outputSchema: generateImageOutputSchema,
});
