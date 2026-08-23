import { describe, expect, it } from "vitest";

import {
	buildProductVideoPrompt,
	PRODUCT_VIDEO_IDENTITY_LAW,
	type ProductVideoPreset,
} from "./product-video-prompts";

const PRESETS = [
	"orbit",
	"hero",
	"lifestyle",
] as const satisfies readonly ProductVideoPreset[];

describe("buildProductVideoPrompt", () => {
	it("is deterministic for the same input", () => {
		const input = {
			preset: "orbit",
			productDetails: "Brushed aluminum body with two black buttons",
			productName: "Arc Speaker",
		} as const;

		expect(buildProductVideoPrompt(input)).toBe(buildProductVideoPrompt(input));
	});

	it.each(
		PRESETS,
	)("covers the %s preset and preserves the identity law", (preset) => {
		const prompt = buildProductVideoPrompt({
			preset,
			productName: "Arc Speaker",
		});

		expect(prompt).toContain("The product is Arc Speaker.");
		expect(prompt).toContain(PRODUCT_VIDEO_IDENTITY_LAW);
		expect(prompt).toContain("Do not add on-screen text");
		expect(prompt).toContain("Do not invent logos or labels");
	});

	it("includes supplied real product facts", () => {
		expect(
			buildProductVideoPrompt({
				preset: "hero",
				productDetails: "Matte red shell and one silver USB-C port",
				productName: "Pocket Drive",
			}),
		).toContain(
			"The product is Pocket Drive. Real product facts: Matte red shell and one silver USB-C port.",
		);
	});

	it("keeps every preset deterministic and distinct", () => {
		const prompts = PRESETS.map((preset) =>
			buildProductVideoPrompt({ preset, productName: "Arc Speaker" }),
		);

		expect(new Set(prompts)).toHaveLength(PRESETS.length);
	});
});
