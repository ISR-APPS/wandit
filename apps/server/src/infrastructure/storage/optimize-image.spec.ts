import { randomBytes } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { optimizeImage } from "./optimize-image";

// Random noise defeats PNG compression, so even small canvases stay well
// above the 150KB optimization threshold.
function noisePng(
	width: number,
	height: number,
	channels: 3 | 4 = 3,
): Promise<Buffer> {
	return sharp(randomBytes(width * height * channels), {
		raw: { channels, height, width },
	})
		.png()
		.toBuffer();
}

// A half-noise, half-solid-red canvas: the noise keeps the PNG above the
// 150KB threshold (and the WebP win real), the solid patch carries a known
// saturated color whose channel values prove or disprove a P3->sRGB
// conversion. The patch pixel is sampled far from the noise boundary so WebP
// block artifacts cannot bleed into it.
const P3_WIDTH = 1400;
const P3_HEIGHT = 300;
const P3_PATCH_PIXEL = { left: 1200, top: 150 };

function noiseWithRedPatchRaw(): Buffer {
	const raw = randomBytes(P3_WIDTH * P3_HEIGHT * 3);

	for (let y = 0; y < P3_HEIGHT; y += 1) {
		for (let x = P3_WIDTH / 2; x < P3_WIDTH; x += 1) {
			const offset = (y * P3_WIDTH + x) * 3;
			raw[offset] = 255;
			raw[offset + 1] = 0;
			raw[offset + 2] = 0;
		}
	}

	return raw;
}

// Stored channel values of one pixel, bypassing sharp's automatic
// ICC import so the actual encoded bytes are observed.
async function storedPatchPixel(bytes: Uint8Array): Promise<number[]> {
	const raw = await sharp(bytes, { ignoreIcc: true })
		.extract({ height: 1, width: 1, ...P3_PATCH_PIXEL })
		.raw()
		.toBuffer();

	return [...raw].slice(0, 3);
}

describe("optimizeImage", () => {
	it("converts Display-P3 pixels to sRGB and tags the output", async () => {
		// withIccProfile("p3") transforms the assumed-sRGB input INTO Display-P3
		// coordinates and tags it (verified against sharp 0.35.x), giving a
		// faithful stand-in for an iPhone photo: the sRGB-red patch is stored as
		// ~(234, 51, 34) under a P3 profile.
		const input = await sharp(noiseWithRedPatchRaw(), {
			raw: { channels: 3, height: P3_HEIGHT, width: P3_WIDTH },
		})
			.png()
			.withIccProfile("p3")
			.toBuffer();
		expect(input.byteLength).toBeGreaterThan(150 * 1024);
		expect((await sharp(input).metadata()).icc).toBeDefined();

		const [naiveR = 0, naiveG = 0] = await storedPatchPixel(input);
		// The naive-strip appearance: a visibly desaturated red.
		expect(naiveR).toBeLessThan(245);
		expect(naiveG).toBeGreaterThan(35);

		const result = await optimizeImage(input, {
			contentType: "image/png",
			ext: "png",
		});

		expect(result.contentType).toBe("image/webp");
		// The output carries a color profile (sRGB), not bare bytes.
		expect((await sharp(result.bytes).metadata()).icc).toBeDefined();

		// The stored pixels are back in sRGB coordinates — saturated red, far
		// from the desaturated values a profile strip would have shipped.
		const [r = 0, g = 0, b = 0] = await storedPatchPixel(result.bytes);
		expect(r).toBeGreaterThan(240);
		expect(g).toBeLessThan(20);
		expect(b).toBeLessThan(20);
		expect(g).toBeLessThan(naiveG - 25);
	});

	it("converts 16-bit P3-tagged pixels to sRGB", async () => {
		// sharp processes 16-bit inputs in a P3 working space, so without an
		// explicit output conversion the WebP would store P3-coded pixels with
		// no profile — the desaturation case the 8-bit path cannot reproduce.
		const input = await sharp(noiseWithRedPatchRaw(), {
			raw: { channels: 3, height: P3_HEIGHT, width: P3_WIDTH },
		})
			.toColourspace("rgb16")
			.png()
			.withIccProfile("p3")
			.toBuffer();
		expect(input.byteLength).toBeGreaterThan(150 * 1024);

		const result = await optimizeImage(input, {
			contentType: "image/png",
			ext: "png",
		});

		expect(result.contentType).toBe("image/webp");

		const [r = 0, g = 0, b = 0] = await storedPatchPixel(result.bytes);
		expect(r).toBeGreaterThan(240);
		expect(g).toBeLessThan(20);
		expect(b).toBeLessThan(20);
	});

	it("resizes a wide raster to 1920 and recompresses it as webp", async () => {
		const input = await noisePng(2500, 300);

		const result = await optimizeImage(input, {
			contentType: "image/png",
			ext: "png",
		});

		expect(result.contentType).toBe("image/webp");
		expect(result.ext).toBe("webp");
		expect(result.bytes.byteLength).toBeLessThan(input.byteLength);

		const metadata = await sharp(result.bytes).metadata();
		expect(metadata.format).toBe("webp");
		expect(metadata.width).toBe(1920);
	});

	it("applies EXIF orientation before recompressing", async () => {
		// Orientation 6 means "rotate 90° CW to display": a stored 2000x500
		// landscape renders as a 500x2000 portrait in browsers. Quality 95
		// keeps the JPEG large enough that the WebP recompression wins.
		const input = await sharp(randomBytes(2000 * 500 * 3), {
			raw: { channels: 3, height: 500, width: 2000 },
		})
			.jpeg({ quality: 95 })
			.withMetadata({ orientation: 6 })
			.toBuffer();
		expect(input.byteLength).toBeGreaterThan(150 * 1024);

		const result = await optimizeImage(input, {
			contentType: "image/jpeg",
			ext: "jpg",
		});

		expect(result.contentType).toBe("image/webp");

		const metadata = await sharp(result.bytes).metadata();
		expect(metadata.width).toBe(500);
		expect(metadata.height).toBe(2000);
		expect(metadata.orientation).toBeUndefined();
	});

	it("preserves alpha through the webp conversion", async () => {
		const input = await noisePng(2200, 260, 4);

		const result = await optimizeImage(input, {
			contentType: "image/png",
			ext: "png",
		});

		expect(result.contentType).toBe("image/webp");

		const metadata = await sharp(result.bytes).metadata();
		expect(metadata.hasAlpha).toBe(true);
	});

	it("never upscales an image narrower than 1920", async () => {
		const input = await noisePng(640, 400);

		const result = await optimizeImage(input, {
			contentType: "image/png",
			ext: "png",
		});

		expect(result.contentType).toBe("image/webp");

		const metadata = await sharp(result.bytes).metadata();
		expect(metadata.width).toBe(640);
	});

	it("returns inputs under 150KB unchanged", async () => {
		const input = await noisePng(24, 24);

		const result = await optimizeImage(input, {
			contentType: "image/png",
			ext: "png",
		});

		expect(result.bytes).toBe(input);
		expect(result.contentType).toBe("image/png");
		expect(result.ext).toBe("png");
	});

	it("returns SVG unchanged regardless of size", async () => {
		const input = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg"><!--${"pad".repeat(60_000)}--><rect width="4000" height="4000"/></svg>`,
		);
		expect(input.byteLength).toBeGreaterThan(150 * 1024);

		const result = await optimizeImage(input, {
			contentType: "image/svg+xml",
			ext: "svg",
		});

		expect(result.bytes).toBe(input);
		expect(result.contentType).toBe("image/svg+xml");
		expect(result.ext).toBe("svg");
	});

	it("returns declared GIFs unchanged", async () => {
		const input = randomBytes(200 * 1024);

		const result = await optimizeImage(input, {
			contentType: "image/gif",
			ext: "gif",
		});

		expect(result.bytes).toBe(input);
		expect(result.contentType).toBe("image/gif");
	});

	it("returns animated inputs unchanged", async () => {
		// Two noise frames stacked as a raw "toilet roll" become a 2-page
		// animated webp; lossless noise stays over the 150KB threshold.
		const input = await sharp(randomBytes(320 * 480 * 3), {
			raw: { channels: 3, height: 480, pageHeight: 240, width: 320 },
		})
			.webp({ effort: 0, lossless: true })
			.toBuffer();
		expect(input.byteLength).toBeGreaterThan(150 * 1024);

		const result = await optimizeImage(input, {
			contentType: "image/webp",
			ext: "webp",
		});

		expect(result.bytes).toBe(input);
		expect(result.contentType).toBe("image/webp");
	});

	it("never throws on non-image bytes, answering them unchanged", async () => {
		const input = randomBytes(200 * 1024);

		const result = await optimizeImage(input, {
			contentType: "image/png",
			ext: "png",
		});

		expect(result.bytes).toBe(input);
		expect(result.contentType).toBe("image/png");
		expect(result.ext).toBe("png");
	});

	it("falls back to generic type fields when nothing is declared", async () => {
		const input = randomBytes(10);

		const result = await optimizeImage(input);

		expect(result).toEqual({
			bytes: input,
			contentType: "application/octet-stream",
			ext: "bin",
		});
	});
});
