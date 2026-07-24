/**
 * Image generation behind the builder's generate_image tool.
 *
 * Executes one approved CreativeSpec shot: generate through the gateway image model,
 * upload to R2 under the attempt, and hand back a browser-reachable URL.
 * Deliberately never throws — a page build must never fail because of
 * images; the builder is told to fall back to CSS/SVG art instead.
 */
import { env } from "@wandit/env/server";
import { generateImage } from "ai";

import {
	isR2Configured,
	publicAssetUrl,
	putSiteFile,
	siteAssetKey,
} from "../../../../infrastructure/storage/r2";

// Hard budget per build: images are the most expensive tool call the builder
// has, and the CreativeSpec is capped at 6 shots anyway.
export const MAX_IMAGES = 6;

// gpt-image-class models accept exact sizes, not free aspect ratios — each
// brief aspect maps onto the nearest supported canvas.
const SIZE_BY_ASPECT = {
	"1:1": "1024x1024",
	"2:3": "1024x1536",
	"3:2": "1536x1024",
	"4:5": "1024x1536",
	"16:9": "1536x1024",
} as const;

export type BuildImageAspect = keyof typeof SIZE_BY_ASPECT;

export const BUILD_IMAGE_ASPECTS = Object.keys(SIZE_BY_ASPECT) as [
	BuildImageAspect,
	...BuildImageAspect[],
];

// No verified gateway/openai option for JPEG/WebP output exists in the
// installed SDK docs, so the model's default (PNG) is kept.
const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

export type GeneratedBuildImage =
	| { message: string; status: "failed" | "unavailable" }
	| {
			/** Raw bytes for toModelOutput only — never stored in the transcript. */
			imageBase64: string;
			mediaType: string;
			status: "generated";
			url: string;
	  };

export async function generateBuildImage(params: {
	abortSignal?: AbortSignal;
	aspect: BuildImageAspect;
	attemptId: string;
	/** 1-based position in the build, used for the R2 object name. */
	index: number;
	projectId: string;
	prompt: string;
}): Promise<GeneratedBuildImage> {
	if (!env.AI_IMAGE_MODEL || !env.R2_PUBLIC_BASE_URL || !isR2Configured()) {
		return {
			message: "image generation not configured — build CSS/SVG art instead",
			status: "unavailable",
		};
	}

	try {
		const { image } = await generateImage({
			...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
			model: env.AI_IMAGE_MODEL,
			prompt: params.prompt,
			size: SIZE_BY_ASPECT[params.aspect],
		});

		const extension = EXTENSION_BY_MEDIA_TYPE[image.mediaType] ?? "png";
		const key = siteAssetKey(
			params.projectId,
			params.attemptId,
			params.index,
			extension,
		);

		await putSiteFile(key, image.uint8Array, image.mediaType);

		return {
			imageBase64: image.base64,
			mediaType: image.mediaType,
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
