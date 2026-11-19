/**
 * Cuts and compares the screenshot bands of a website clone, with sharp.
 * The `capture_site` host tool calls `cutScreenshotBands`, and the
 * `compare_clone` host tool calls `diffCloneBands`. The sizes and the pixel
 * rule come from `domain/site-clone.ts`. An image that sharp cannot read throws.
 */
import sharp from "sharp";

import { SHARP_DECODE_OPTIONS } from "../../../../infrastructure/storage/optimize-image";
import {
	bandRectsOf,
	CLONE_BAND_PASS_PERCENT,
	CLONE_VIEWPORTS,
	type CloneViewportName,
	diffBandPixels,
} from "../../domain/site-clone";

// sharp ships as a CommonJS export=, so its instance type is derived from the function itself.
type SharpPipeline = ReturnType<typeof sharp>;

// The same quality as the clone screenshot of the rules (`--screenshot-quality 80`).
const BAND_JPEG_QUALITY = 80;
// Bands compare at one quarter of their size. This ignores font smoothing and shifts of 1 to 2 px.
const COMPARE_SCALE = 4;

/** The top of one screenshot at the image width of its viewport. */
type PageTop = {
	/** Raw RGB rows from the page top, 3 bytes per pixel, `widthPx` wide and `heightPx` high. */
	rgb: Buffer;
	widthPx: number;
	heightPx: number;
	/** Height of the full screenshot at the same width, in image px. `rgb` can hold fewer rows. */
	fullHeightPx: number;
};

// Decodes at most `maxHeightPx` rows of a screenshot, so a very long page cannot fill the memory of the worker.
async function readPageTop(
	image: Uint8Array,
	viewport: CloneViewportName,
	maxHeightPx: number,
): Promise<PageTop> {
	const { imageWidthPx } = CLONE_VIEWPORTS[viewport];
	const metadata = await sharp(image, SHARP_DECODE_OPTIONS).metadata();
	// Image px of the result for each px of the screenshot.
	const scale = imageWidthPx / metadata.width;
	// sharp refuses an area of 0 rows, so at least one row stays.
	const keptSourceRows = Math.min(
		metadata.height,
		Math.max(1, Math.ceil(maxHeightPx / scale)),
	);
	const { data, info } = await toRgb(
		sharp(image, SHARP_DECODE_OPTIONS)
			.extract({
				left: 0,
				top: 0,
				width: metadata.width,
				height: keptSourceRows,
			})
			.resize({ width: imageWidthPx }),
	).toBuffer({ resolveWithObject: true });
	return {
		rgb: data,
		widthPx: info.width,
		heightPx: info.height,
		fullHeightPx: Math.round(metadata.height * scale),
	};
}

// Every input becomes 3 bytes per pixel: a clear pixel shows the white page, and a gray image gets 3 channels.
function toRgb(pipeline: SharpPipeline): SharpPipeline {
	return pipeline
		.flatten({ background: "#ffffff" })
		.toColourspace("srgb")
		.raw();
}

// The rows of one band inside the raw RGB rows of a page.
function bandRowsOf(
	page: PageTop,
	rect: { top: number; height: number },
): Buffer {
	const rowBytes = page.widthPx * 3;
	return page.rgb.subarray(
		rect.top * rowBytes,
		(rect.top + rect.height) * rowBytes,
	);
}

function jpegOf(rgb: Uint8Array, widthPx: number, heightPx: number) {
	return sharp(rgb, { raw: { width: widthPx, height: heightPx, channels: 3 } })
		.jpeg({ quality: BAND_JPEG_QUALITY })
		.toBuffer();
}

/**
 * Resizes a full-page screenshot to the viewport image width and cuts JPEG bands (quality 80).
 * `pageHeightCssPx` is the height of the full page. `isCut` is true when the
 * page is longer than `maxBands` bands, so the bands do not show its end.
 */
export async function cutScreenshotBands(
	image: Uint8Array,
	viewport: CloneViewportName,
): Promise<{ bands: Uint8Array[]; pageHeightCssPx: number; isCut: boolean }> {
	const { bandHeightPx, cssWidthPx, imageWidthPx, maxBands } =
		CLONE_VIEWPORTS[viewport];
	const maxHeightPx = bandHeightPx * maxBands;
	const page = await readPageTop(image, viewport, maxHeightPx);
	const bands = await Promise.all(
		bandRectsOf(page.heightPx, bandHeightPx, maxBands).map((rect) =>
			jpegOf(bandRowsOf(page, rect), page.widthPx, rect.height),
		),
	);
	return {
		bands,
		// Image px to CSS px: the mobile image is at double size.
		pageHeightCssPx: Math.round(
			(page.fullHeightPx * cssWidthPx) / imageWidthPx,
		),
		isCut: page.fullHeightPx > maxHeightPx,
	};
}

/**
 * Compares each source band with the same area of the clone screenshot.
 * `sourceBands` are the files of `cutScreenshotBands`, from the page top.
 * `diffImage` is a JPEG of the clone band with the different pixels in red. It
 * is null for a band that passes, and for a band below the end of the clone.
 */
export async function diffCloneBands(
	sourceBands: Uint8Array[],
	cloneScreenshot: Uint8Array,
	viewport: CloneViewportName,
): Promise<{
	cloneHeightCssPx: number;
	bands: { mismatchPercent: number; diffImage: Uint8Array | null }[];
}> {
	const { bandHeightPx, cssWidthPx, imageWidthPx } = CLONE_VIEWPORTS[viewport];
	const clone = await readPageTop(
		cloneScreenshot,
		viewport,
		sourceBands.length * bandHeightPx,
	);
	const compareWidthPx = Math.round(imageWidthPx / COMPARE_SCALE);
	const compareHeightOf = (heightPx: number) =>
		Math.max(1, Math.round(heightPx / COMPARE_SCALE));
	const shrink = (pipeline: SharpPipeline, heightPx: number) =>
		toRgb(
			pipeline.resize(compareWidthPx, compareHeightOf(heightPx), {
				fit: "fill",
			}),
		).toBuffer();

	const bands = await Promise.all(
		sourceBands.map(async (sourceBand, index) => {
			const top = index * bandHeightPx;
			// The clone page ends above this band, so no pixel of the band matches.
			if (clone.heightPx <= top) {
				return { mismatchPercent: 100, diffImage: null };
			}
			const source = sharp(sourceBand, SHARP_DECODE_OPTIONS);
			const sourceHeightPx = (await source.metadata()).height;
			// A band past the clone bottom is cut to the clone image.
			const cloneHeightPx = Math.min(sourceHeightPx, clone.heightPx - top);
			const cloneRows = bandRowsOf(clone, { top, height: cloneHeightPx });
			const [sourceRgb, cloneRgb] = await Promise.all([
				shrink(source, sourceHeightPx),
				shrink(
					sharp(cloneRows, {
						raw: { width: clone.widthPx, height: cloneHeightPx, channels: 3 },
					}),
					cloneHeightPx,
				),
			]);
			const { mismatchPercent, isDifferent } = diffBandPixels(
				sourceRgb,
				cloneRgb,
			);
			if (mismatchPercent <= CLONE_BAND_PASS_PERCENT) {
				return { mismatchPercent, diffImage: null };
			}
			const marked = markDifferentPixels(
				cloneRows,
				clone.widthPx,
				cloneHeightPx,
				isDifferent,
				compareWidthPx,
				compareHeightOf(cloneHeightPx),
			);
			return {
				mismatchPercent,
				diffImage: await jpegOf(marked, clone.widthPx, cloneHeightPx),
			};
		}),
	);
	return {
		bands,
		// Image px to CSS px: the mobile image is at double size.
		cloneHeightCssPx: Math.round(
			(clone.fullHeightPx * cssWidthPx) / imageWidthPx,
		),
	};
}

// Returns a copy of the clone band with a red tint on each different pixel.
// `isDifferent` is the small mask of `diffBandPixels`, `maskWidthPx` wide. Each band pixel reads the nearest mask pixel.
function markDifferentPixels(
	bandRgb: Buffer,
	widthPx: number,
	heightPx: number,
	isDifferent: Uint8Array,
	maskWidthPx: number,
	maskHeightPx: number,
): Buffer {
	const marked = Buffer.from(bandRgb);
	for (let y = 0; y < heightPx; y += 1) {
		const maskRowStart =
			Math.floor((y * maskHeightPx) / heightPx) * maskWidthPx;
		for (let x = 0; x < widthPx; x += 1) {
			const maskX = Math.floor((x * maskWidthPx) / widthPx);
			if (isDifferent[maskRowStart + maskX] !== 1) {
				continue;
			}
			const offset = (y * widthPx + x) * 3;
			// Full red, and half of green and blue: the content stays readable under the tint.
			marked.writeUInt8(255, offset);
			marked.writeUInt8(marked.readUInt8(offset + 1) >> 1, offset + 1);
			marked.writeUInt8(marked.readUInt8(offset + 2) >> 1, offset + 2);
		}
	}
	return marked;
}
