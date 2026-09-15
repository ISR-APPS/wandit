/**
 * The `generate_image` host tool of the builder turn (WANDIT-169).
 * `BuilderHostToolRegistry` builds it once per turn; the harness calls it
 * in the task process so image generation, billing, and R2 writes stay
 * out of the sandbox. It reuses the V1 `generateBuildImage` pipeline and
 * copies the V1 child-hold helpers, which are private to
 * `site-builder-agent.ts`.
 */
import { posix } from "node:path";

import {
	type GenerateImageHostToolInput,
	type GenerateImageHostToolOutput,
	generateImageHostToolInputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import {
	EXTENSION_BY_MEDIA_TYPE,
	generateBuildImage,
	MAX_IMAGES,
} from "../../../ai-chat/agent/site-builder/generate-image";
import { redactProviderText } from "../../../ai-errors/domain";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	type MeasuredOperationReservation,
	measuredDirectSettlement,
	measuredReserveCredits,
	reservationTermsFromEvent,
} from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { MeasuredCostEstimateInput } from "../../../metering/application/services/model-pricing.service";
import {
	fixedGenerationStepUsage,
	type GatewayGenerationMetadata,
	hasGatewayGenerationMetadata,
} from "../../../metering/domain/gateway-metering";
import type { HostToolContext } from "../../domain/ports/host-tools";

/** The `MeteringService` slice the image tool bills through; specs fake it. */
export type HostToolMetering = Pick<
	MeteringService,
	| "captureGeneration"
	| "estimateMeasuredCost"
	| "refund"
	| "reserve"
	| "settle"
	| "usdMicrosPerCredit"
>;

/** What the registry hands the image tool factory. */
export type GenerateImageHostToolDeps = {
	metering: HostToolMetering;
	/** `AI_IMAGE_MODEL` as the task reads it at run start; null lets the V1 path read the env. */
	imageModel: string | null;
	/** `AI_IMAGE_EDIT_MODEL` as the task reads it at run start; used for calls with `sourceImageUrls`. */
	imageEditModel: string | null;
	/** Spec seam; the default is the real gateway pipeline. */
	generateImage?: typeof generateBuildImage;
	logger: Pick<Console, "info" | "warn">;
};

/**
 * Builds the AI SDK tool the harness sees. The image budget counter is a
 * closure here because the registry calls this factory once per turn.
 */
export function createGenerateImageTool(
	deps: GenerateImageHostToolDeps,
	context: HostToolContext,
): Tool<GenerateImageHostToolInput, GenerateImageHostToolOutput> {
	const generateImage = deps.generateImage ?? generateBuildImage;
	let imageSequence = 0;

	return tool({
		description:
			"Generate ONE image and write it into the project. Never text, " +
			"logos or watermarks inside an image. `path` is project-relative " +
			"and must start with public/ or src/assets/. Returns the hosted " +
			`URL and the final path. Max ${MAX_IMAGES} attempts per turn; on ` +
			"unavailable/failed, build CSS/SVG art instead.",
		inputSchema: generateImageHostToolInputSchema,
		execute: async (
			{ aspect, path, prompt, sourceImageUrls },
			{ abortSignal },
		): Promise<GenerateImageHostToolOutput> => {
			const startedAt = Date.now();
			const finish = (
				output: GenerateImageHostToolOutput,
			): GenerateImageHostToolOutput => {
				deps.logger.info("host-tool.generate_image", {
					durationMs: Date.now() - startedAt,
					status: output.status,
					turnId: context.turnId,
				});
				return output;
			};

			// The path is the only sandbox write target the model picks, so it
			// is checked before any credit moves.
			if (posix.isAbsolute(path) || path.split("/").includes("..")) {
				return finish({
					message: "path must be relative without .. segments",
					status: "failed",
				});
			}
			const normalizedPath = posix.normalize(path);
			if (
				!normalizedPath.startsWith("public/") &&
				!normalizedPath.startsWith("src/assets/")
			) {
				return finish({
					message: "path must start with public/ or src/assets/",
					status: "failed",
				});
			}
			// A path that ends in "/" names a directory; the extension rewrite would write a hidden ".png" file.
			if (normalizedPath.endsWith("/")) {
				return finish({ message: "path must name a file", status: "failed" });
			}

			if (imageSequence >= MAX_IMAGES) {
				return finish({
					message: `Image budget exhausted (${MAX_IMAGES} per turn)`,
					status: "failed",
				});
			}
			// One step's tool calls run concurrently; the slot is taken before
			// the first await so parallel calls cannot share an index.
			imageSequence += 1;
			const index = imageSequence;

			if (context.holdEventId === null) {
				return finish({ message: "billing unavailable", status: "failed" });
			}

			// A call with source photos is billed at the edit model's price.
			const model =
				sourceImageUrls !== undefined &&
				sourceImageUrls.length > 0 &&
				deps.imageEditModel !== null
					? deps.imageEditModel
					: deps.imageModel;
			const childReservation = await reserveMeasuredChild(deps.metering, {
				attemptRef: `${context.turnId}:image:${index}`,
				estimate: model ? { count: 1, kind: "image", modelId: model } : null,
				// One key per turn and image index: a task retry replays the same reservation instead of a second hold.
				idempotencyKey: `builder-turn-image:${context.turnId}:${index}`,
				model,
				parentEventId: context.holdEventId,
				subject: context.subject,
			});
			const childEvent = childReservation.event;
			let generationCaptured = false;

			const result = await generateImage({
				...(abortSignal ? { abortSignal } : {}),
				aspect,
				attemptId: context.turnId,
				...(deps.imageEditModel !== null
					? { imageEditModel: deps.imageEditModel }
					: {}),
				...(deps.imageModel !== null ? { imageModel: deps.imageModel } : {}),
				index,
				metering: {
					operation: "image",
					organizationId: context.subject.organizationId ?? null,
					userId: context.subject.actorUserId,
				},
				onProviderGeneration: async (generation: GatewayGenerationMetadata) => {
					await captureRequiredGeneration(deps.metering, childEvent.id, {
						providerMetadata: generation.providerMetadata,
						stepUsage: fixedGenerationStepUsage(generation.usage, 1),
					});
					generationCaptured = true;
				},
				projectId: context.projectId,
				prompt,
				...(sourceImageUrls !== undefined && sourceImageUrls.length > 0
					? { sourceImageUrls }
					: {}),
			});

			if (result.status !== "generated") {
				if (hasGatewayGenerationMetadata(result)) {
					// The provider finished work before the failure; the customer
					// pays the completed units and the rest is refunded.
					const providerUnits =
						"providerUnits" in result && result.providerUnits === 1 ? 1 : 0;
					if (!generationCaptured) {
						await captureRequiredGeneration(deps.metering, childEvent.id, {
							providerMetadata: result.providerMetadata,
							stepUsage: fixedGenerationStepUsage(
								result.usage,
								providerUnits,
								providerUnits === 0 ? "refunded_failure" : undefined,
							),
						});
					}
					await deps.metering.settle(childEvent.id, {
						...measuredDirectSettlement(childReservation.reservation, {
							completedUnits: providerUnits,
						}),
						model: result.model,
						rawUsage: result.usage ?? null,
					});
				} else {
					await deps.metering.refund(
						childEvent.id,
						"builder_turn_image_failed",
					);
				}
				// A provider body can echo a source photo URL, a credential, or a full HTML page.
				return finish({
					message: redactProviderText(result.message).slice(0, 4096),
					status: result.status,
				});
			}

			if (!generationCaptured) {
				await captureRequiredGeneration(deps.metering, childEvent.id, {
					providerMetadata: result.providerMetadata,
					stepUsage: fixedGenerationStepUsage(result.usage, 1),
				});
			}
			await deps.metering.settle(childEvent.id, {
				...measuredDirectSettlement(childReservation.reservation),
				model: result.model,
				rawUsage: result.usage ?? null,
			});

			// The project file extension must match the stored media type;
			// a wrong extension makes the browser read the bytes wrong.
			const extension = EXTENSION_BY_MEDIA_TYPE[result.mediaType] ?? "png";
			const finalPath = `${normalizedPath.slice(
				0,
				normalizedPath.length - posix.extname(normalizedPath).length,
			)}.${extension}`;
			await context.sandbox.writeFiles([
				{
					content: Buffer.from(result.imageBase64, "base64"),
					path: posix.join(context.sandbox.workspaceDir, finalPath),
				},
			]);

			return finish({
				height: result.height,
				path: finalPath,
				status: "generated",
				url: result.url,
				width: result.width,
			});
		},
	});
}

/**
 * One child hold under the turn's `builder-turn:<turnId>` event. The
 * reservation terms come back from the durable event so a replay keeps
 * the reserved price.
 */
async function reserveMeasuredChild(
	metering: HostToolMetering,
	input: {
		attemptRef: string;
		estimate: MeasuredCostEstimateInput | null;
		idempotencyKey: string;
		model: string | null;
		parentEventId: string;
		subject: MeteringSubject;
	},
): Promise<{
	event: Awaited<ReturnType<HostToolMetering["reserve"]>>;
	reservation: MeasuredOperationReservation;
}> {
	const quote = input.estimate
		? await metering.estimateMeasuredCost(input.estimate)
		: null;
	const estimatedCostUsdMicros = quote?.costUsdMicros ?? null;
	const event = await metering.reserve("image", input.subject, {
		attemptRef: input.attemptRef,
		credits: measuredReserveCredits(
			"image",
			1,
			estimatedCostUsdMicros,
			metering.usdMicrosPerCredit,
		),
		estimatedCostUsdMicros,
		idempotencyKey: input.idempotencyKey,
		measuredTerms: { estimatedUnitUsdMicros: estimatedCostUsdMicros, units: 1 },
		model: input.model,
		parentEventId: input.parentEventId,
	});

	return {
		event,
		reservation: {
			credits: event.reservedCredits,
			eventId: event.id,
			operation: "image",
			referenceId: input.attemptRef,
			replay: "none",
			terms: reservationTermsFromEvent(event),
			units: 1,
		},
	};
}

/**
 * Persists the gateway generation ref on the child event. The ref is the
 * only proof the provider did billable work, so a dropped write retries.
 */
async function captureRequiredGeneration(
	metering: HostToolMetering,
	eventId: string,
	capture: Parameters<HostToolMetering["captureGeneration"]>[1],
): Promise<void> {
	let lastError: unknown;

	// Three tries: one transient gateway or database error must not lose the billing proof.
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			const generationRef = await metering.captureGeneration(eventId, capture);

			if (!generationRef) {
				throw new Error("AI Gateway generation id is missing");
			}

			return;
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError;
}
