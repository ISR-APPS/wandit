/**
 * Optimizes still raster images before R2 uploads.
 * Upload and image-generation callers use its dimensions and WebP renditions.
 * It caps primary width at 1920 px and height at 8000 px.
 * It leaves SVG, GIF, animated inputs, and unreadable bytes unchanged.
 * It calls sharp for metadata, orientation, resizing, color conversion, and encoding.
 */
import sharp from "sharp";

// sharp ships as a CommonJS export=, so its instance and metadata types are
// derived from the function itself instead of imported by name.
type SharpPipeline = ReturnType<typeof sharp>;
type SharpMetadata = Awaited<ReturnType<SharpPipeline["metadata"]>>;

const MIN_OPTIMIZE_BYTES = 150 * 1024;
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;

/**
 * Samsung JPEGs can contain SOS parameters that libjpeg reports as warnings.
 * Sharp ignores decoder warnings but rejects broken image data.
 */
export const SHARP_DECODE_OPTIONS = { failOn: "error" } as const;

// LIMIT: one shared budget serves all current image providers. Upgrade: select a budget for each provider.
/** OpenAI accepts no more than 30,000 image patches. */
export const MAX_MODEL_IMAGE_PATCHES = 30_000;

/** OpenAI calculates image patches from 32 px squares. */
export const MODEL_IMAGE_PATCH_PX = 32;

/** Anthropic accepts no image side longer than 8,000 px. */
export const MAX_MODEL_IMAGE_SIDE_PX = 8000;

/** Google Gemini on Vertex accepts inline images of at most 7,000,000 bytes. */
export const MAX_MODEL_IMAGE_BYTES = 7_000_000;

// Layout breakpoints worth a rendition: a phone, a tablet/half-width column,
// and a desktop hero below the 1920 primary.
const DEFAULT_VARIANT_WIDTHS = [480, 960, 1600];

// Still-raster formats sharp can safely recompress. SVG (vector) and GIF
// (animation container) are deliberately absent.
const OPTIMIZABLE_FORMATS = new Set([
	"avif",
	"heif",
	"jpeg",
	"jpg",
	"png",
	"tiff",
	"webp",
]);

export type OptimizedImage = {
	bytes: Uint8Array;
	contentType: string;
	ext: string;
	/** Intrinsic height of the RETURNED bytes; null when unknowable. */
	height: number | null;
	/** Intrinsic width of the RETURNED bytes; null when unknowable. */
	width: number | null;
};

export type ImageVariant = {
	bytes: Uint8Array;
	contentType: "image/webp";
	ext: "webp";
	height: number;
	width: number;
};

/**
 * The one WebP pipeline, shared by the primary object and every variant so a
 * rendition can never drift from the image it must match.
 *
 * The pipeline applies EXIF orientation before resizing because WebP output carries no orientation metadata.
 * The primary image uses fit inside with width 1920 px and height 8000 px.
 * Variants use the requested width and the same height cap.
 *
 * withIccProfile("srgb") makes the output genuinely sRGB: pixels are
 * converted out of the input profile (Display-P3 iPhone photos, and the P3
 * working space sharp uses for 16-bit inputs, would otherwise ship
 * desaturated once the profile is stripped) and an sRGB profile is attached.
 * Verified empirically against sharp 0.35.x.
 */
function webpPipeline(bytes: Uint8Array, width: number): SharpPipeline {
	return (
		sharp(bytes, SHARP_DECODE_OPTIONS)
			.autoOrient()
			// Anthropic rejects a side above 8,000 px. The height cap keeps tall panoramas under it.
			.resize({
				fit: "inside",
				height: MAX_MODEL_IMAGE_SIDE_PX,
				width,
				withoutEnlargement: true,
			})
			.withIccProfile("srgb")
			.webp({ quality: WEBP_QUALITY })
	);
}

/**
 * EXIF orientations 5 through 8 swap the display axes after autoOrient runs.
 * model-safe-photo uses the same rule for stored photos.
 */
export function displayDimensions(metadata: SharpMetadata): {
	height: number | null;
	width: number | null;
} {
	const width = metadata.width ?? null;
	const height = metadata.height ?? null;

	return (metadata.orientation ?? 1) >= 5
		? { height: width, width: height }
		: { height, width };
}

/** Applies the strictest shared limits before a provider receives a photo. */
export function isModelSafeImage(image: {
	byteLength: number;
	height: number;
	width: number;
}): boolean {
	// OpenAI counts a partial 32 px square as one full patch.
	const patches =
		Math.ceil(image.width / MODEL_IMAGE_PATCH_PX) *
		Math.ceil(image.height / MODEL_IMAGE_PATCH_PX);

	return (
		patches <= MAX_MODEL_IMAGE_PATCHES &&
		image.width <= MAX_MODEL_IMAGE_SIDE_PX &&
		image.height <= MAX_MODEL_IMAGE_SIDE_PX &&
		image.byteLength <= MAX_MODEL_IMAGE_BYTES
	);
}

/** Optimizes still images and keeps known dimensions after a logged encode failure. */
export async function optimizeImage(
	bytes: Uint8Array,
	declared: { contentType?: string; ext?: string } = {},
): Promise<OptimizedImage> {
	const unchanged: OptimizedImage = {
		bytes,
		contentType: declared.contentType ?? "application/octet-stream",
		ext: declared.ext ?? "bin",
		height: null,
		width: null,
	};

	const declaredType = (declared.contentType ?? "").toLowerCase();
	const declaredExt = (declared.ext ?? "").toLowerCase();

	if (
		declaredType.includes("svg") ||
		declaredType === "image/gif" ||
		declaredExt === "svg" ||
		declaredExt === "gif"
	) {
		return unchanged;
	}

	let metadata: SharpMetadata;

	try {
		metadata = await sharp(bytes, SHARP_DECODE_OPTIONS).metadata();
	} catch (error) {
		console.warn(
			`[optimize-image] Failed to read ${unchanged.contentType} ` +
				`(${bytes.byteLength} bytes): ${
					error instanceof Error ? error.message : String(error)
				}`,
		);
		return unchanged;
	}

	const source = displayDimensions(metadata);

	if (
		!OPTIMIZABLE_FORMATS.has(metadata.format ?? "") ||
		(metadata.pages ?? 1) > 1
	) {
		return { ...unchanged, height: source.height, width: source.width };
	}

	// Heavy bytes and excessive dimensions independently require recompression.
	// A byte-only gate misses a 269 KB PNG with a 3,072 px width.
	// The metadata read makes the dimension check inexpensive for each file.
	const heavy = bytes.byteLength >= MIN_OPTIMIZE_BYTES;
	const oversized =
		(source.width !== null && source.width > MAX_WIDTH) ||
		(source.height !== null && source.height > MAX_MODEL_IMAGE_SIDE_PX);

	if (!heavy && !oversized) {
		return { ...unchanged, height: source.height, width: source.width };
	}

	try {
		const optimized = await webpPipeline(bytes, MAX_WIDTH).toBuffer({
			resolveWithObject: true,
		});

		// A recompression that grew the file is a regression, not a win. The
		// pass-through still reports the dimensions we now know.
		if (optimized.data.byteLength >= bytes.byteLength) {
			return { ...unchanged, height: source.height, width: source.width };
		}

		return {
			bytes: optimized.data,
			contentType: "image/webp",
			ext: "webp",
			height: optimized.info.height,
			width: optimized.info.width,
		};
	} catch (error) {
		console.warn(
			`[optimize-image] Failed to encode ${unchanged.contentType} ` +
				`(${bytes.byteLength} bytes): ${
					error instanceof Error ? error.message : String(error)
				}`,
		);
		return { ...unchanged, height: source.height, width: source.width };
	}
}

/**
 * Narrower WebP renditions of one image, for a srcset. Same never-throw
 * contract as optimizeImage: a width that fails to encode is simply absent
 * from the answer — variants are an optimization, never a reason to lose the
 * upload they belong to.
 *
 * Widths at or above the source width are skipped: upscaling costs bytes and
 * buys no pixels.
 */
export async function buildImageVariants(
	bytes: Uint8Array,
	options: { widths?: number[] } = {},
): Promise<ImageVariant[]> {
	const widths = [...(options.widths ?? DEFAULT_VARIANT_WIDTHS)].sort(
		(a, b) => a - b,
	);
	let sourceWidth: number | null = null;

	try {
		const metadata = await sharp(bytes, SHARP_DECODE_OPTIONS).metadata();

		// Same exclusions as the primary path: vectors, animations and formats
		// sharp must not recompress have no meaningful renditions.
		if (
			!OPTIMIZABLE_FORMATS.has(metadata.format ?? "") ||
			(metadata.pages ?? 1) > 1
		) {
			return [];
		}

		sourceWidth = displayDimensions(metadata).width;
	} catch {
		return [];
	}

	const variants: ImageVariant[] = [];

	for (const width of widths) {
		if (width <= 0 || (sourceWidth !== null && width >= sourceWidth)) {
			continue;
		}

		try {
			const rendered = await webpPipeline(bytes, width).toBuffer({
				resolveWithObject: true,
			});

			variants.push({
				bytes: rendered.data,
				contentType: "image/webp",
				ext: "webp",
				height: rendered.info.height,
				width: rendered.info.width,
			});
		} catch {
			// One width failing must not cost the caller the other widths.
		}
	}

	return variants;
}
