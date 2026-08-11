/**
 * Standalone image generation behind the chat's generate_image tool.
 *
 * Two provider paths share one result shape: pure text-to-image through the
 * gateway image model, and EDIT mode through a multimodal language model
 * (generateText + file parts + result.files — AI SDK 7's contract for
 * image-output language models) when user source photos must stay faithful.
 * Plain functions, no NestJS: the Trigger.dev worker and the site builder
 * both import from here.
 */
import type { ImageGenerationAspect } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { generateImage, generateText } from "ai";

import { optimizeImage } from "../../../../infrastructure/storage/optimize-image";
import {
	imageGenerationKey,
	isR2Configured,
	publicAssetUrl,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import {
	type GatewayGenerationFailure,
	type GatewayGenerationMetadata,
	type GatewayMeteringContext,
	gatewayGenerationCaptureFromError,
	withGatewayAttribution,
} from "../../../metering/domain/gateway-metering";

// gpt-image-class models accept exact canvases, not free aspect ratios —
// every contract aspect maps onto the nearest supported canvas.
export const STANDALONE_SIZE_BY_ASPECT: Record<
	ImageGenerationAspect,
	"1024x1024" | "1024x1536" | "1536x1024"
> = {
	"1:1": "1024x1024",
	"2:3": "1024x1536",
	"3:2": "1536x1024",
	"4:3": "1536x1024",
	"4:5": "1024x1536",
	"9:16": "1024x1536",
	"16:9": "1536x1024",
};

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

// Prefixed before the caller's prompt on every edit call so the one thing
// that must never drift — the real product — is the first instruction the
// model reads.
export const SOURCE_FIDELITY_INSTRUCTION =
	"Edit the provided photo(s). Keep the product/logo EXACTLY faithful — " +
	"shape, materials, label, colors, proportions — while restaging " +
	"everything else according to this direction: ";

export type EditImageResult =
	| GatewayGenerationFailure
	| ({
			mediaType: string;
			status: "generated";
			uint8Array: Uint8Array;
	  } & GatewayGenerationMetadata);

/**
 * Low-level edit call, shared with the site builder's in-build image tool.
 * Never throws; a failed edit is a normal result the caller can degrade on.
 */
export async function editImageFromSources(params: {
	abortSignal?: AbortSignal;
	aspect: string;
	metering: GatewayMeteringContext<"image">;
	prompt: string;
	sourceImageUrls: readonly string[];
}): Promise<EditImageResult> {
	if (!env.AI_IMAGE_EDIT_MODEL) {
		return {
			message: "AI_IMAGE_EDIT_MODEL is not configured",
			status: "failed",
		};
	}

	let providerEvidence: GatewayGenerationMetadata | null = null;

	try {
		const result = await generateText({
			...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
			messages: [
				{
					content: [
						{
							text:
								`${SOURCE_FIDELITY_INSTRUCTION}${params.prompt}\n` +
								`Target aspect ratio: ${params.aspect}.`,
							type: "text" as const,
						},
						...params.sourceImageUrls.map((url) => ({
							data: url,
							// Generic "image" is the AI SDK 7 documented shorthand when
							// the exact MIME type of a URL source is unknown.
							mediaType: "image",
							type: "file" as const,
						})),
					],
					role: "user" as const,
				},
			],
			model: env.AI_IMAGE_EDIT_MODEL,
			// Best-effort aspect steering for Gemini image models; unknown
			// provider options are forwarded and ignored by other providers.
			providerOptions: withGatewayAttribution(
				{ google: { imageConfig: { aspectRatio: params.aspect } } },
				params.metering,
			),
		});
		providerEvidence = {
			model: env.AI_IMAGE_EDIT_MODEL,
			providerMetadata: result.providerMetadata,
			usage: result.usage,
		};

		const file = result.files.find((candidate) =>
			candidate.mediaType.startsWith("image/"),
		);

		if (!file) {
			return {
				...providerEvidence,
				message: "the edit model returned no image",
				providerUnits: 0,
				status: "failed",
			};
		}

		return {
			mediaType: file.mediaType,
			model: env.AI_IMAGE_EDIT_MODEL,
			providerMetadata: result.providerMetadata,
			status: "generated",
			uint8Array: file.uint8Array,
			usage: result.usage,
		};
	} catch (error) {
		const errorCapture = gatewayGenerationCaptureFromError(error);
		const evidence =
			providerEvidence ??
			(errorCapture
				? {
						model: env.AI_IMAGE_EDIT_MODEL,
						providerMetadata: errorCapture.providerMetadata,
					}
				: null);

		return {
			...(evidence ?? {}),
			message: error instanceof Error ? error.message : String(error),
			...(evidence ? { providerUnits: 0 } : {}),
			status: "failed",
		};
	}
}

/**
 * Nano-banana-class Gemini image models are LANGUAGE models on the gateway —
 * generateImage refuses them outright ("is a language model, not an image
 * model"); their images come back through generateText's result.files, the
 * same contract the edit path uses. Google's true image models (imagen-*)
 * stay on the image API.
 */
function isLanguageImageModel(model: string): boolean {
	return model.startsWith("google/gemini-");
}

/**
 * Text-to-image through whichever API shape the configured model requires.
 * Shared by the standalone generator and the site builder's in-build tool.
 * Never throws; a failed generation is a normal result the caller degrades on.
 */
export async function generateImageFromPrompt(params: {
	abortSignal?: AbortSignal;
	/** Free aspect ratio for language image models (e.g. "2:3"). */
	aspect: string;
	metering: GatewayMeteringContext<"image">;
	model: string;
	prompt: string;
	/** Exact canvas for gpt-image-class models (e.g. "1024x1536"). */
	size: "1024x1024" | "1024x1536" | "1536x1024";
}): Promise<EditImageResult> {
	let providerEvidence: GatewayGenerationMetadata | null = null;

	try {
		if (isLanguageImageModel(params.model)) {
			const result = await generateText({
				...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
				model: params.model,
				prompt: params.prompt,
				providerOptions: withGatewayAttribution(
					{ google: { imageConfig: { aspectRatio: params.aspect } } },
					params.metering,
				),
			});
			providerEvidence = {
				model: params.model,
				providerMetadata: result.providerMetadata,
				usage: result.usage,
			};

			const file = result.files.find((candidate) =>
				candidate.mediaType.startsWith("image/"),
			);

			if (!file) {
				return {
					...providerEvidence,
					message: "the image model returned no image",
					providerUnits: 0,
					status: "failed",
				};
			}

			return {
				mediaType: file.mediaType,
				model: params.model,
				providerMetadata: result.providerMetadata,
				status: "generated",
				uint8Array: file.uint8Array,
				usage: result.usage,
			};
		}

		const result = await generateImage({
			...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
			model: params.model,
			prompt: params.prompt,
			providerOptions: withGatewayAttribution({}, params.metering),
			size: params.size,
		});
		providerEvidence = {
			model: params.model,
			providerMetadata: result.providerMetadata,
			usage: result.usage,
		};

		return {
			mediaType: result.image.mediaType,
			model: params.model,
			providerMetadata: result.providerMetadata,
			status: "generated",
			uint8Array: result.image.uint8Array,
			usage: result.usage,
		};
	} catch (error) {
		const errorCapture = gatewayGenerationCaptureFromError(error);
		const evidence =
			providerEvidence ??
			(errorCapture
				? {
						model: params.model,
						providerMetadata: errorCapture.providerMetadata,
					}
				: null);

		return {
			...(evidence ?? {}),
			message: error instanceof Error ? error.message : String(error),
			...(evidence ? { providerUnits: 0 } : {}),
			status: "failed",
		};
	}
}

export type GeneratedStandaloneImage =
	| GatewayGenerationFailure
	| { message: string; status: "unavailable" }
	| ({
			mediaType: string;
			status: "generated";
			url: string;
	  } & GatewayGenerationMetadata);

/**
 * Execute ONE image of a standalone attempt: generate (or edit), upload to
 * R2 under the attempt, and hand back a browser-reachable URL. Deliberately
 * never throws — the runner turns failed results into a settled attempt.
 */
export async function generateStandaloneImage(params: {
	abortSignal?: AbortSignal;
	aspect: ImageGenerationAspect;
	attemptId: string;
	/** 1-based position in the attempt, used for the R2 object name. */
	index: number;
	metering: GatewayMeteringContext<"image">;
	/** Persist Gateway evidence before bytes become recoverable in R2. */
	onProviderGeneration?: (
		generation: GatewayGenerationMetadata,
	) => Promise<void>;
	projectId: string;
	prompt: string;
	sourceImageUrls: readonly string[];
}): Promise<GeneratedStandaloneImage> {
	if (!env.AI_IMAGE_MODEL || !env.R2_PUBLIC_BASE_URL || !isR2Configured()) {
		return {
			message: "standalone image generation is not configured",
			status: "unavailable",
		};
	}

	let metadata: GatewayGenerationMetadata | null = null;

	try {
		let mediaType: string;
		let bytes: Uint8Array;

		if (params.sourceImageUrls.length > 0) {
			const edited = await editImageFromSources(params);

			if (edited.status !== "generated") {
				return edited;
			}

			mediaType = edited.mediaType;
			bytes = edited.uint8Array;
			metadata = edited;
		} else {
			const generated = await generateImageFromPrompt({
				...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
				aspect: params.aspect,
				metering: params.metering,
				model: env.AI_IMAGE_MODEL,
				prompt: params.prompt,
				size: STANDALONE_SIZE_BY_ASPECT[params.aspect],
			});

			if (generated.status !== "generated") {
				return generated;
			}

			mediaType = generated.mediaType;
			bytes = generated.uint8Array;
			metadata = generated;
		}

		await params.onProviderGeneration?.(metadata);

		// Providers answer raw PNGs of 1-2MB each — recompress before the bytes
		// become a publicly served URL. Recovery probes already list webp.
		const optimized = await optimizeImage(bytes, {
			contentType: mediaType,
			ext: EXTENSION_BY_MEDIA_TYPE[mediaType] ?? "png",
		});
		const key = imageGenerationKey(
			params.projectId,
			params.attemptId,
			params.index,
			optimized.ext,
		);

		await putSiteFile(key, optimized.bytes, optimized.contentType);

		return {
			mediaType: optimized.contentType,
			model: metadata.model,
			...(metadata.provider ? { provider: metadata.provider } : {}),
			providerMetadata: metadata.providerMetadata,
			status: "generated",
			url: publicAssetUrl(key),
			...(metadata.usage === undefined ? {} : { usage: metadata.usage }),
		};
	} catch (error) {
		return {
			...(metadata ?? {}),
			message: error instanceof Error ? error.message : String(error),
			...(metadata ? { providerUnits: 1 } : {}),
			status: "failed",
		};
	}
}
