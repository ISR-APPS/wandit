import type { ImageGenerationAttempt } from "@wandit/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./chat-media", () => ({
	ChatMediaGallery: () => createElement("div", { "data-gallery": true }),
}));

import { ImageGenerationResult } from "./generate-image-part";

function attempt(
	placement: ImageGenerationAttempt["placement"],
): ImageGenerationAttempt {
	return {
		id: "00000000-0000-4000-8000-000000000001",
		status: "succeeded",
		title: "Product image",
		prompt: "A product on a clean background",
		aspect: "1:1",
		count: 1,
		sourceImageUrls: [],
		images: [
			{
				url: "https://assets.example.com/generated.png",
				mediaType: "image/png",
			},
		],
		placement,
		error: null,
		createdAt: "2026-08-01T10:00:00.000Z",
		completedAt: "2026-08-01T10:01:00.000Z",
	};
}

describe("ImageGenerationResult", () => {
	it("shows a localized note only when page placement failed", () => {
		const failed = renderToStaticMarkup(
			createElement(ImageGenerationResult, {
				attempt: attempt({ status: "failed" }),
			}),
		);
		expect(failed).toContain("workspace.chat.generateImage.placementFailed");

		for (const placement of [{ status: "applied" } as const, undefined]) {
			const html = renderToStaticMarkup(
				createElement(ImageGenerationResult, {
					attempt: attempt(placement),
				}),
			);
			expect(html).not.toContain(
				"workspace.chat.generateImage.placementFailed",
			);
		}
	});
});
