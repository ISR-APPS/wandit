/**
 * Image generation behind the builder's generate_image tool.
 *
 * Executes one shot from the brief's SHOT LIST: generate through the gateway image model,
 * upload to R2 under the attempt, and hand back a browser-reachable URL.
 * Deliberately never throws — a page build must never fail because of
 * images; the builder is told to fall back to CSS/SVG art instead.
 */
import { env } from "@wandit/env/server";

import { optimizeImage } from "../../../../infrastructure/storage/optimize-image";
import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isR2Configured,
	publicAssetUrl,
	putSiteFile,
	siteAssetKey,
} from "../../../../infrastructure/storage/r2";
import { storeImageVariants } from "../../../../infrastructure/storage/store-image-variants";
import {
	editImageFromSources,
	generateImageFromPrompt,
	withSingleFrameInstruction,
} from "../../../image-generations/application/services/image-generator";
import type {
	GatewayGenerationFailure,
	GatewayGenerationMetadata,
	GatewayMeteringContext,
} from "../../../metering/domain/gateway-metering";

// Hard budget per build: images are the most expensive tool call the builder
// has, and the brief's SHOT LIST is capped at 6 shots anyway.
export const MAX_IMAGES = 6;

// Hard per-shot deadline. One step's tool calls run as a Promise.all, so a
// single stalled provider call would otherwise hold the whole build hostage;
// a timed-out shot degrades to CSS/SVG art like any other failed shot.
export const IMAGE_PROVIDER_TIMEOUT_MS = 180_000;

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
			/** Intrinsic height of the STORED object, for the img attribute. */
			height: number;
			/** Raw bytes for toModelOutput only — never stored in the transcript. */
			imageBase64: string;
			mediaType: string;
			status: "generated";
			url: string;
			/** Intrinsic width of the STORED object, for the img attribute. */
			width: number;
	  } & GatewayGenerationMetadata);

export async function generateBuildImage(params: {
	abortSignal?: AbortSignal;
	aspect: BuildImageAspect;
	attemptId: string;
	/**
	 * Image models snapshotted at queue time. The env reads below stay ONLY
	 * as the fallback for legacy attempts whose spec predates the snapshot.
	 */
	imageEditModel?: string;
	imageModel?: string;
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
	const imageModel = params.imageModel ?? env.AI_IMAGE_MODEL;
	const imageEditModel = params.imageEditModel ?? env.AI_IMAGE_EDIT_MODEL;

	if (!imageModel || !env.R2_PUBLIC_BASE_URL || !isR2Configured()) {
		return {
			message: "image generation not configured — build CSS/SVG art instead",
			status: "unavailable",
		};
	}

	let metadata: GatewayGenerationMetadata | null = null;
	// One SHOT LIST line is one frame: never let a shot come back as a collage.
	const prompt = withSingleFrameInstruction(params.prompt);
	// Same deadline pattern as generate-video: the timeout abort classifies as
	// a normal failed result, never an exception out of this function.
	const timeoutSignal = AbortSignal.timeout(IMAGE_PROVIDER_TIMEOUT_MS);
	const providerAbortSignal = params.abortSignal
		? AbortSignal.any([params.abortSignal, timeoutSignal])
		: timeoutSignal;

	try {
		let mediaType: string;
		let bytes: Uint8Array;

		// A missing edit model degrades to text-only generation on purpose — a
		// page build must never fail because photo-faithful mode is unconfigured.
		if (
			params.sourceImageUrls &&
			params.sourceImageUrls.length > 0 &&
			imageEditModel
		) {
			const edited = await editImageFromSources({
				abortSignal: providerAbortSignal,
				aspect: params.aspect,
				metering: params.metering,
				model: imageEditModel,
				prompt,
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
				abortSignal: providerAbortSignal,
				aspect: params.aspect,
				metering: params.metering,
				model: imageModel,
				prompt,
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

		// Providers answer raw PNGs of 1-2MB each — recompress before the bytes
		// become part of a published page (and of the model transcript).
		const optimized = await optimizeImage(bytes, {
			contentType: mediaType,
			ext: EXTENSION_BY_MEDIA_TYPE[mediaType] ?? "png",
		});
		const key = siteAssetKey(
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
		// Renditions ride beside the primary object. Best effort by contract —
		// a build must never fail because a srcset width did not encode.
		await storeImageVariants(key, optimized.bytes);

		// The provider canvas is the fallback: it is the size we ASKED for, so
		// it is right whenever sharp could not measure the bytes back.
		const canvas = canvasDimensions(params.aspect);

		return {
			height: optimized.height ?? canvas.height,
			imageBase64: Buffer.from(optimized.bytes).toString("base64"),
			mediaType: optimized.contentType,
			model: metadata.model,
			...(metadata.provider ? { provider: metadata.provider } : {}),
			providerMetadata: metadata.providerMetadata,
			status: "generated",
			url: publicAssetUrl(key),
			...(metadata.usage === undefined ? {} : { usage: metadata.usage }),
			width: optimized.width ?? canvas.width,
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

// "1536x1024" -> { height: 1024, width: 1536 }.
function canvasDimensions(aspect: BuildImageAspect): {
	height: number;
	width: number;
} {
	const [width = 0, height = 0] = SIZE_BY_ASPECT[aspect]
		.split("x")
		.map((part) => Number.parseInt(part, 10));

	return { height, width };
}
