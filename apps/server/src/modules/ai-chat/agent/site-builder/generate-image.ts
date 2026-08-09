/**
 * Image generation behind the builder's generate_image tool.
 *
 * Executes one shot from the brief's SHOT LIST: generate through the gateway image model,
 * upload to R2 under the attempt, and hand back a browser-reachable URL.
 * Deliberately never throws — a page build must never fail because of
 * images; the builder is told to fall back to CSS/SVG art instead.
 */
import { env } from "@wandit/env/server";

import {
	isR2Configured,
	publicAssetUrl,
	putSiteFile,
	siteAssetKey,
} from "../../../../infrastructure/storage/r2";
import {
	editImageFromSources,
	generateImageFromPrompt,
} from "../../../image-generations/application/services/image-generator";
import type {
	GatewayGenerationFailure,
	GatewayGenerationMetadata,
	GatewayMeteringContext,
} from "../../../metering/domain/gateway-metering";

// Hard budget per build: images are the most expensive tool call the builder
// has, and the brief's SHOT LIST is capped at 6 shots anyway.
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
	| GatewayGenerationFailure
	| { message: string; status: "unavailable" }
	| ({
			/** Raw bytes for toModelOutput only — never stored in the transcript. */
			imageBase64: string;
			mediaType: string;
			status: "generated";
			url: string;
	  } & GatewayGenerationMetadata);

export async function generateBuildImage(params: {
	abortSignal?: AbortSignal;
	aspect: BuildImageAspect;
	attemptId: string;
	/** 1-based position in the build, used for the R2 object name. */
	index: number;
	metering: GatewayMeteringContext<"image">;
	/** Persist Gateway evidence before bytes become recoverable in R2. */
	onProviderGeneration?: (
		generation: GatewayGenerationMetadata,
	) => Promise<void>;
	projectId: string;
	prompt: string;
	/**
	 * User asset URLs from the brief's BRAND ASSETS — when present (and the
	 * edit model is configured) the shot is produced by EDITING the real
	 * photos instead of inventing the product.
	 */
	sourceImageUrls?: string[];
}): Promise<GeneratedBuildImage> {
	if (!env.AI_IMAGE_MODEL || !env.R2_PUBLIC_BASE_URL || !isR2Configured()) {
		return {
			message: "image generation not configured — build CSS/SVG art instead",
			status: "unavailable",
		};
	}

	let metadata: GatewayGenerationMetadata | null = null;

	try {
		let mediaType: string;
		let bytes: Uint8Array;

		// A missing edit model degrades to text-only generation on purpose — a
		// page build must never fail because photo-faithful mode is unconfigured.
		if (
			params.sourceImageUrls &&
			params.sourceImageUrls.length > 0 &&
			env.AI_IMAGE_EDIT_MODEL
		) {
			const edited = await editImageFromSources({
				...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
				aspect: params.aspect,
				metering: params.metering,
				prompt: params.prompt,
				sourceImageUrls: params.sourceImageUrls,
			});

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
				size: SIZE_BY_ASPECT[params.aspect],
			});

			if (generated.status !== "generated") {
				return generated;
			}

			mediaType = generated.mediaType;
			bytes = generated.uint8Array;
			metadata = generated;
		}

		await params.onProviderGeneration?.(metadata);

		const extension = EXTENSION_BY_MEDIA_TYPE[mediaType] ?? "png";
		const key = siteAssetKey(
			params.projectId,
			params.attemptId,
			params.index,
			extension,
		);

		await putSiteFile(key, bytes, mediaType);

		return {
			imageBase64: Buffer.from(bytes).toString("base64"),
			mediaType,
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
