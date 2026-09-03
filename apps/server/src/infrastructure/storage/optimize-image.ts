/**
 * Raster-image optimization before an R2 upload: cap width at 1920 (never
 * upscaling) and recompress as WebP q80 with alpha intact, so published
 * pages stop shipping multi-megabyte PNGs. Anything that must not be
 * touched — SVG, GIF, animated inputs, non-image bytes — passes through
 * unchanged, and NO failure ever escapes: a broken image ships as-is instead
 * of failing its upload.
 *
 * Two things a caller needs and could not get before: the POST-optimization
 * intrinsic dimensions (so an <img> can carry real width/height and reserve
 * its box), and narrower renditions for a srcset.
 */
import sharp from "sharp";

// sharp ships as a CommonJS export=, so its instance and metadata types are
// derived from the function itself instead of imported by name.
type SharpPipeline = ReturnType<typeof sharp>;
type SharpMetadata = Awaited<ReturnType<SharpPipeline["metadata"]>>;

const MIN_OPTIMIZE_BYTES = 150 * 1024;
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;

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
 * Rotate pixels per the EXIF orientation tag BEFORE resizing: the WebP output
 * carries no orientation metadata, so phone photos would render sideways
 * without this. The width cap applies to the displayed axis.
 *
 * withIccProfile("srgb") makes the output genuinely sRGB: pixels are
 * converted out of the input profile (Display-P3 iPhone photos, and the P3
 * working space sharp uses for 16-bit inputs, would otherwise ship
 * desaturated once the profile is stripped) and an sRGB profile is attached.
 * Verified empirically against sharp 0.35.x.
 */
function webpPipeline(bytes: Uint8Array, width: number): SharpPipeline {
	return sharp(bytes)
		.autoOrient()
		.resize({ width, withoutEnlargement: true })
		.withIccProfile("srgb")
		.webp({ quality: WEBP_QUALITY });
}

// What the browser will SEE: EXIF orientations 5-8 turn the image a quarter
// turn, so the stored axes are swapped once autoOrient() has run.
function displayDimensions(metadata: SharpMetadata): {
	height: number | null;
	width: number | null;
} {
	const width = metadata.width ?? null;
	const height = metadata.height ?? null;

	return (metadata.orientation ?? 1) >= 5
		? { height: width, width: height }
		: { height, width };
}

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

	try {
		const metadata = await sharp(bytes).metadata();

		if (
			!OPTIMIZABLE_FORMATS.has(metadata.format ?? "") ||
			(metadata.pages ?? 1) > 1
		) {
			return unchanged;
		}

		const source = displayDimensions(metadata);

		// TWO independent reasons to recompress, because either one alone
		// misses real traffic: heavy bytes, and a canvas wider than any layout
		// can use. A 269KB 3072px PNG passes a byte gate and still ships 13
		// megapixels to a phone — the header parse above is what makes the
		// dimension trigger affordable on every file.
		const heavy = bytes.byteLength >= MIN_OPTIMIZE_BYTES;
		const oversized = source.width !== null && source.width > MAX_WIDTH;

		if (!heavy && !oversized) {
			return { ...unchanged, height: source.height, width: source.width };
		}

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
	} catch {
		return unchanged;
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
		const metadata = await sharp(bytes).metadata();

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
