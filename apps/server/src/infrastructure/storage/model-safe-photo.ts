/**
 * Sends stored photos to models as inline bytes within shared limits.
 * Page builds and image edits load photos through this file.
 * Uploads use its guard. It calls R2, sharp, and the image optimizer.
 */
import sharp from "sharp";

import {
	displayDimensions,
	isModelSafeImage,
	MAX_MODEL_IMAGE_BYTES,
	MAX_MODEL_IMAGE_PATCHES,
	MAX_MODEL_IMAGE_SIDE_PX,
	MODEL_IMAGE_PATCH_PX,
	optimizeImage,
	SHARP_DECODE_OPTIONS,
} from "./optimize-image";
import { getObjectBytes, publicAssetKeyFromUrl } from "./r2";

/** Keeps safety-policy imports stable while optimize-image owns the resize limits. */
export {
	isModelSafeImage,
	MAX_MODEL_IMAGE_BYTES,
	MAX_MODEL_IMAGE_PATCHES,
	MAX_MODEL_IMAGE_SIDE_PX,
	MODEL_IMAGE_PATCH_PX,
};

/** Keeps the source URL for HTML placement and supplies bytes or the reason that a photo is unusable. */
export type ModelSafePhoto =
	| {
			bytes: Uint8Array;
			kind: "bytes";
			mediaType: string;
			url: string;
	  }
	| { kind: "unusable"; reason: string; url: string };

// R2 answers in well under one second. A 30 s wait means the object is stuck.
const PHOTO_LOAD_TIMEOUT_MS = 30_000;

// Photos larger than 2 MB get a WebP recompression attempt before they travel as base64.
// MAX_BRIEF_USER_PHOTOS caps builder attachments at six photos.
// Six photos of 2 MB use about 16 MB after base64 expansion, less than the 20 MB request cap.
const MAX_INLINE_PHOTO_BYTES = 2_000_000;

// These formats let every current provider read inline photos. Other formats require WebP output from the optimizer.
const MEDIA_TYPE_BY_FORMAT: Record<string, string> = {
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
};

function unusablePhoto(url: string, reason: string): ModelSafePhoto {
	console.warn(`[model-safe-photo] ${reason}: ${url}`);
	return { kind: "unusable", reason, url };
}

/**
 * Loads one Wandit photo as inline bytes and sends large or unsupported formats to the optimizer.
 * The function logs unusable results and never throws.
 */
export async function loadModelSafePhoto(
	url: string,
	deps: {
		getObjectBytes: (key: string) => Promise<Uint8Array | null>;
		publicAssetKeyFromUrl: (url: string) => string | null;
	} = { getObjectBytes, publicAssetKeyFromUrl },
): Promise<ModelSafePhoto> {
	try {
		// Only an exact Wandit asset URL can select an R2 object key.
		const key = deps.publicAssetKeyFromUrl(url);

		if (key === null) {
			return unusablePhoto(url, "not a Wandit asset URL");
		}

		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		let bytes: Uint8Array | null;

		try {
			bytes = await Promise.race([
				// LIMIT: one full R2 read per photo per build and per edit. Upgrade: store width, height, and size at upload time and read them from the attachment record.
				deps.getObjectBytes(key),
				new Promise<never>((_resolve, reject) => {
					timeoutId = setTimeout(() => {
						reject(new Error("object read timed out after 30 s"));
					}, PHOTO_LOAD_TIMEOUT_MS);
				}),
			]);
		} finally {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}
		}

		if (bytes === null) {
			return unusablePhoto(url, "object missing");
		}

		const metadata = await sharp(bytes, SHARP_DECODE_OPTIONS).metadata();
		const dimensions = displayDimensions(metadata);

		// A model budget cannot approve a photo without both display dimensions.
		if (dimensions.width === null || dimensions.height === null) {
			return unusablePhoto(url, "image dimensions are unavailable");
		}

		const mediaType = MEDIA_TYPE_BY_FORMAT[metadata.format ?? ""];

		// Small photos in supported formats need no second encode when they fit the model limits.
		if (
			bytes.byteLength <= MAX_INLINE_PHOTO_BYTES &&
			mediaType !== undefined &&
			isModelSafeImage({
				byteLength: bytes.byteLength,
				height: dimensions.height,
				width: dimensions.width,
			})
		) {
			// Inline bytes remove the gateway fetch that can fail and make Google reject bare URLs (gen_01M25HVEVN2VKWBSDEY0J4K644).
			return { bytes, kind: "bytes", mediaType, url };
		}

		// The optimizer preserves this type when bytes stay unchanged, so the detected format must override the key extension.
		const optimized = await optimizeImage(bytes, {
			contentType: mediaType ?? "application/octet-stream",
		});

		// The optimizer can preserve unsupported bytes, so only supported output types can reach a provider.
		if (!Object.values(MEDIA_TYPE_BY_FORMAT).includes(optimized.contentType)) {
			return unusablePhoto(url, "unsupported image format");
		}

		// The model limits also apply to the optimizer output.
		// LIMIT: optimizer output can reach 7 MB per photo if WebP does not shrink it. Upgrade: budget each request.
		if (
			optimized.width !== null &&
			optimized.height !== null &&
			isModelSafeImage({
				byteLength: optimized.bytes.byteLength,
				height: optimized.height,
				width: optimized.width,
			})
		) {
			return {
				bytes: optimized.bytes,
				kind: "bytes",
				mediaType: optimized.contentType,
				url,
			};
		}

		// The shared model policy rejects a photo that still exceeds one limit.
		return unusablePhoto(url, "image exceeds model limits after processing");
	} catch (error) {
		return unusablePhoto(
			url,
			error instanceof Error ? error.message : String(error),
		);
	}
}
