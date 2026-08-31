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
	IMMUTABLE_ASSET_CACHE_CONTROL,
	imageGenerationKey,
	isR2Configured,
	publicAssetUrl,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { storeImageVariants } from "../../../../infrastructure/storage/store-image-variants";
import {
	type AiErrorContext,
	classifyAiError,
	classifyFinish,
	type NormalizedAiError,
	renderAiErrorSentence,
} from "../../../ai-errors/domain";
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

/**
 * Appended to every standalone prompt. A chat model that writes "a 4-shot
 * product shoot" into one prompt gets a collage inside ONE picture from the
 * image model; each requested image is its own provider call and its own
 * file, so every call must render exactly one frame.
 */
export const SINGLE_FRAME_INSTRUCTION =
	"Render exactly ONE image as a single full-frame picture, in the medium " +
	"the description names. Never a grid, collage, contact sheet, " +
	"split-screen, before/after panels, storyboard, or multi-panel layout; if " +
	"the description lists several shots, angles, or variations, depict only " +
	"one of them in this image.";

export function withSingleFrameInstruction(prompt: string): string {
	return `${prompt.trim()}\n${SINGLE_FRAME_INSTRUCTION}`;
}

export type ClassifiedImageGenerationFailure = GatewayGenerationFailure & {
	failure: NormalizedAiError;
};

export type EditImageResult =
	| ClassifiedImageGenerationFailure
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
		const error = new Error("AI image editing is not configured");
		const failure = classifyImageError(error, {
			route: "none",
			surface: "image",
		});
		return {
			failure,
			message: renderAiErrorSentence(failure),
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
			telemetry: { functionId: "image.edit" },
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
			const failure = classifyImageFinish({
				...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
				finishReason: result.finishReason,
				model: env.AI_IMAGE_EDIT_MODEL,
				outputFiles: result.files,
				providerMetadata: result.providerMetadata,
				...(result.rawFinishReason
					? { rawFinishReason: result.rawFinishReason }
					: {}),
				route: "vercel",
				surface: "image",
			});
			return {
				...providerEvidence,
				failure,
				message: renderAiErrorSentence(failure),
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
		const failure = classifyImageError(error, {
			...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
			model: env.AI_IMAGE_EDIT_MODEL,
			providerMetadata: evidence?.providerMetadata,
			route: "vercel",
			surface: "image",
		});

		return {
			...(evidence ?? {}),
			failure,
			message: renderAiErrorSentence(failure),
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
				telemetry: { functionId: "image.generate_text" },
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
				const failure = classifyImageFinish({
					...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
					finishReason: result.finishReason,
					model: params.model,
					outputFiles: result.files,
					providerMetadata: result.providerMetadata,
					...(result.rawFinishReason
						? { rawFinishReason: result.rawFinishReason }
						: {}),
					route: "vercel",
					surface: "image",
				});
				return {
					...providerEvidence,
					failure,
					message: renderAiErrorSentence(failure),
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
		const failure = classifyImageError(error, {
			...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
			model: params.model,
			providerMetadata: evidence?.providerMetadata,
			route: "vercel",
			surface: "image",
		});

		return {
			...(evidence ?? {}),
			failure,
			message: renderAiErrorSentence(failure),
			...(evidence ? { providerUnits: 0 } : {}),
			status: "failed",
		};
	}
}

export type GeneratedStandaloneImage =
	| ClassifiedImageGenerationFailure
	| {
			failure: NormalizedAiError;
			message: string;
			status: "unavailable";
	  }
	| ({
			/** Intrinsic height of the STORED object, for the img attribute. */
			height: number;
			mediaType: string;
			status: "generated";
			/** Deferred best-effort renditions; the Trigger runtime drains this. */
			storeVariants?: () => Promise<void>;
			url: string;
			/** Intrinsic width of the STORED object, for the img attribute. */
			width: number;
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
	/** Return variant work to the Trigger runtime instead of awaiting it. */
	deferVariants?: boolean;
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
		const error = new Error("Standalone image generation is not configured");
		const failure = classifyImageError(error, {
			...(env.AI_IMAGE_MODEL ? { model: env.AI_IMAGE_MODEL } : {}),
			route: "none",
			surface: "image",
		});
		return {
			failure,
			message: renderAiErrorSentence(failure),
			status: "unavailable",
		};
	}

	let metadata: GatewayGenerationMetadata | null = null;
	const prompt = withSingleFrameInstruction(params.prompt);

	try {
		let mediaType: string;
		let bytes: Uint8Array;

		if (params.sourceImageUrls.length > 0) {
			const edited = await editImageFromSources({ ...params, prompt });

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
				prompt,
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

		await putSiteFile(
			key,
			optimized.bytes,
			optimized.contentType,
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		const storeVariants = async () => {
			await storeImageVariants(key, optimized.bytes);
		};

		// Non-Trigger callers retain the old fully-awaited behavior. Trigger uses
		// the thunk so the primary URL can be persisted as progress immediately.
		if (!params.deferVariants) {
			await storeVariants();
		}

		// The provider canvas is the fallback: it is the size we ASKED for, so
		// it is right whenever sharp could not measure the bytes back.
		const canvas = standaloneCanvasDimensions(params.aspect);

		return {
			height: optimized.height ?? canvas.height,
			mediaType: optimized.contentType,
			model: metadata.model,
			...(metadata.provider ? { provider: metadata.provider } : {}),
			providerMetadata: metadata.providerMetadata,
			status: "generated",
			...(params.deferVariants ? { storeVariants } : {}),
			url: publicAssetUrl(key),
			...(metadata.usage === undefined ? {} : { usage: metadata.usage }),
			width: optimized.width ?? canvas.width,
		};
	} catch (error) {
		const model =
			metadata?.model ??
			(params.sourceImageUrls.length > 0
				? env.AI_IMAGE_EDIT_MODEL
				: env.AI_IMAGE_MODEL);
		const failure = classifyImageError(error, {
			...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
			...(model ? { model } : {}),
			providerMetadata: metadata?.providerMetadata,
			route: metadata ? "vercel" : "none",
			surface: "image",
		});
		return {
			...(metadata ?? {}),
			failure,
			message: renderAiErrorSentence(failure),
			...(metadata ? { providerUnits: 1 } : {}),
			status: "failed",
		};
	}
}

function classifyImageError(
	error: unknown,
	context: AiErrorContext,
): NormalizedAiError {
	const classified = classifyAiError(error, context);
	if (classified) return classified;

	// Warning-only SDK errors are not expected from these one-shot calls. If one
	// does escape, classify the failed image result as a provider failure rather
	// than returning an unstructured or provider-authored string.
	const fallback = classifyAiError(
		{ code: 500, message: "Image generation failed", type: "provider_error" },
		{ ...context, abortSignal: undefined, route: "vercel" },
	);
	if (!fallback) {
		throw new Error("Image failure classification returned no result");
	}
	return fallback;
}

function classifyImageFinish(context: AiErrorContext): NormalizedAiError {
	const classified = classifyFinish(context);
	if (classified) return classified;

	return classifyImageError(
		{
			code: 500,
			message: "Image model returned no image",
			type: "provider_error",
		},
		{ ...context, abortSignal: undefined, route: "vercel" },
	);
}

// "1536x1024" -> { height: 1024, width: 1536 }.
function standaloneCanvasDimensions(aspect: ImageGenerationAspect): {
	height: number;
	width: number;
} {
	const [width = 0, height = 0] = STANDALONE_SIZE_BY_ASPECT[aspect]
		.split("x")
		.map((part) => Number.parseInt(part, 10));

	return { height, width };
}
