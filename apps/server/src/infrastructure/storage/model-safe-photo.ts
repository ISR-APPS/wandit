/**
 * Keeps stored photos within model input limits.
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
import { contentTypeFor, getObjectBytes, publicAssetKeyFromUrl } from "./r2";

/** Keeps safety-policy imports stable while optimize-image owns the resize limits. */
export {
	isModelSafeImage,
	MAX_MODEL_IMAGE_BYTES,
	MAX_MODEL_IMAGE_PATCHES,
	MAX_MODEL_IMAGE_SIDE_PX,
	MODEL_IMAGE_PATCH_PX,
};

/** Describes the model input, or the reason that a photo is unusable. */
export type ModelSafePhoto =
	| { kind: "url"; url: string }
	| {
			bytes: Uint8Array;
			kind: "bytes";
			mediaType: string;
			url: string;
	  }
	| { kind: "unusable"; reason: string; url: string };

// R2 answers in well under one second. A 30 s wait means the object is stuck.
const PHOTO_LOAD_TIMEOUT_MS = 30_000;

function unusablePhoto(url: string, reason: string): ModelSafePhoto {
	console.warn(`[model-safe-photo] ${reason}: ${url}`);
	return { kind: "unusable", reason, url };
}

/**
 * Loads one Wandit photo and optimizes it only when the stored object exceeds a model limit.
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

		// A safe stored object needs no inline bytes or second encode.
		if (
			isModelSafeImage({
				byteLength: bytes.byteLength,
				height: dimensions.height,
				width: dimensions.width,
			})
		) {
			return { kind: "url", url };
		}

		const optimized = await optimizeImage(bytes, {
			contentType: contentTypeFor(key),
		});

		// An unsafe URL can still reach a provider unchanged. Send the checked replacement bytes instead.
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
