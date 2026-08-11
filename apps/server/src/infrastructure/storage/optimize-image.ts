/**
 * Raster-image optimization before an R2 upload: cap width at 1920 (never
 * upscaling) and recompress as WebP q80 with alpha intact, so published
 * pages stop shipping multi-megabyte PNGs. Anything that must not be
 * touched — SVG, GIF, animated inputs, already-small files, non-image
 * bytes — passes through unchanged, and NO failure ever escapes: a broken
 * image ships as-is instead of failing its upload.
 */
import sharp from "sharp";

const MIN_OPTIMIZE_BYTES = 150 * 1024;
const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;

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
};

export async function optimizeImage(
	bytes: Uint8Array,
	declared: { contentType?: string; ext?: string } = {},
): Promise<OptimizedImage> {
	const unchanged: OptimizedImage = {
		bytes,
		contentType: declared.contentType ?? "application/octet-stream",
		ext: declared.ext ?? "bin",
	};

	if (bytes.byteLength < MIN_OPTIMIZE_BYTES) {
		return unchanged;
	}

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

		// Rotate pixels per the EXIF orientation tag BEFORE resizing: the WebP
		// output carries no orientation metadata, so phone photos would render
		// sideways without this. The width cap applies to the displayed axis.
		//
		// withIccProfile("srgb") makes the output genuinely sRGB: pixels are
		// converted out of the input profile (Display-P3 iPhone photos, and the
		// P3 working space sharp uses for 16-bit inputs, would otherwise ship
		// desaturated once the profile is stripped) and an sRGB profile is
		// attached. Verified empirically against sharp 0.35.x.
		const optimized = await sharp(bytes)
			.autoOrient()
			.resize({ width: MAX_WIDTH, withoutEnlargement: true })
			.withIccProfile("srgb")
			.webp({ quality: WEBP_QUALITY })
			.toBuffer();

		// A recompression that grew the file is a regression, not a win.
		if (optimized.byteLength >= bytes.byteLength) {
			return unchanged;
		}

		return { bytes: optimized, contentType: "image/webp", ext: "webp" };
	} catch {
		return unchanged;
	}
}
