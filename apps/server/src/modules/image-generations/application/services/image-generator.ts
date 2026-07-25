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

import {
	imageGenerationKey,
	isR2Configured,
	publicAssetUrl,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";

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
	| { message: string; status: "failed" }
	| { mediaType: string; status: "generated"; uint8Array: Uint8Array };

/**
 * Low-level edit call, shared with the site builder's in-build image tool.
 * Never throws; a failed edit is a normal result the caller can degrade on.
 */
export async function editImageFromSources(params: {
	abortSignal?: AbortSignal;
	aspect: string;
	prompt: string;
	sourceImageUrls: readonly string[];
}): Promise<EditImageResult> {
	if (!env.AI_IMAGE_EDIT_MODEL) {
		return {
			message: "AI_IMAGE_EDIT_MODEL is not configured",
			status: "failed",
		};
	}

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
			providerOptions: {
				google: { imageConfig: { aspectRatio: params.aspect } },
			},
		});

		const file = result.files.find((candidate) =>
			candidate.mediaType.startsWith("image/"),
		);

		if (!file) {
			return {
				message: "the edit model returned no image",
				status: "failed",
			};
		}

		return {
			mediaType: file.mediaType,
			status: "generated",
			uint8Array: file.uint8Array,
		};
	} catch (error) {
		return {
			message: error instanceof Error ? error.message : String(error),
			status: "failed",
		};
	}
}

export type GeneratedStandaloneImage =
	| { message: string; status: "failed" | "unavailable" }
	| { mediaType: string; status: "generated"; url: string };

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

	try {
		let mediaType: string;
		let bytes: Uint8Array;

		if (params.sourceImageUrls.length > 0) {
			const edited = await editImageFromSources(params);

			if (edited.status !== "generated") {
				return { message: edited.message, status: "failed" };
			}

			mediaType = edited.mediaType;
			bytes = edited.uint8Array;
		} else {
			const { image } = await generateImage({
				...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
				model: env.AI_IMAGE_MODEL,
				prompt: params.prompt,
				size: STANDALONE_SIZE_BY_ASPECT[params.aspect],
			});

			mediaType = image.mediaType;
			bytes = image.uint8Array;
		}

		const extension = EXTENSION_BY_MEDIA_TYPE[mediaType] ?? "png";
		const key = imageGenerationKey(
			params.projectId,
			params.attemptId,
			params.index,
			extension,
		);

		await putSiteFile(key, bytes, mediaType);

		return {
			mediaType,
			status: "generated",
			url: publicAssetUrl(key),
		};
	} catch (error) {
		return {
			message: error instanceof Error ? error.message : String(error),
			status: "failed",
		};
	}
}
