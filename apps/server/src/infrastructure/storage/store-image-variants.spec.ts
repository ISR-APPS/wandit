import { randomBytes } from "node:crypto";

import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMMUTABLE_ASSET_CACHE_CONTROL, putSiteFile } from "./r2";
import { storeImageVariants } from "./store-image-variants";

const mockEnv = vi.hoisted(() => ({
	R2_PUBLIC_BASE_URL: "https://assets.example.com",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("./r2", async (importOriginal) => {
	const original = await importOriginal<typeof import("./r2")>();

	return { ...original, putSiteFile: vi.fn() };
});

function noisePng(width: number, height: number): Promise<Buffer> {
	return sharp(randomBytes(width * height * 3), {
		raw: { channels: 3, height, width },
	})
		.png()
		.toBuffer();
}

beforeEach(() => {
	vi.mocked(putSiteFile).mockReset().mockResolvedValue(undefined);
});

describe("storeImageVariants", () => {
	it("uploads each rendition beside the primary, cached forever", async () => {
		const bytes = await noisePng(2000, 400);

		const stored = await storeImageVariants(
			"uploads/user_1/upload_1/hero.webp",
			bytes,
		);

		expect(stored).toEqual([
			{
				url: "https://assets.example.com/uploads/user_1/upload_1/hero.w480.webp",
				width: 480,
			},
			{
				url: "https://assets.example.com/uploads/user_1/upload_1/hero.w960.webp",
				width: 960,
			},
			{
				url: "https://assets.example.com/uploads/user_1/upload_1/hero.w1600.webp",
				width: 1600,
			},
		]);
		expect(putSiteFile).toHaveBeenCalledWith(
			"uploads/user_1/upload_1/hero.w480.webp",
			expect.any(Uint8Array),
			"image/webp",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
	});

	it("keeps the renditions that landed when one upload fails", async () => {
		const bytes = await noisePng(2000, 400);
		vi.mocked(putSiteFile).mockImplementation(async (key) =>
			key.endsWith(".w960.webp")
				? Promise.reject(new Error("R2 said no"))
				: undefined,
		);

		const stored = await storeImageVariants(
			"uploads/user_1/upload_1/hero.webp",
			bytes,
		);

		// A partial srcset is still narrower than no srcset.
		expect(stored.map((variant) => variant.width)).toEqual([480, 1600]);
	});

	it("answers nothing (never throws) for bytes sharp cannot read", async () => {
		const stored = await storeImageVariants(
			"uploads/user_1/upload_1/hero.webp",
			randomBytes(4096),
		);

		expect(stored).toEqual([]);
		expect(putSiteFile).not.toHaveBeenCalled();
	});
});
