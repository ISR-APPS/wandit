import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

import {
	ImageAnimationFailure,
	shouldShowAnimationSourceImage,
} from "./animate-image-part";

describe("ImageAnimationFailure", () => {
	it("shows the server-provided attempt error", () => {
		const html = renderToStaticMarkup(
			createElement(ImageAnimationFailure, {
				error: "The source image could not be processed.",
			}),
		);

		expect(html).toContain("The source image could not be processed.");
		expect(html).not.toContain("workspace.chat.animateImage.failedBody");
	});

	it("uses generic copy when the attempt has no error", () => {
		const html = renderToStaticMarkup(
			createElement(ImageAnimationFailure, { error: null }),
		);

		expect(html).toContain("workspace.chat.animateImage.failedBody");
	});
});

describe("animation source image fallback", () => {
	it("suppresses only the failed URL and retries when the source changes", () => {
		const failedUrl = "https://assets.example.com/source-v1.png";

		expect(shouldShowAnimationSourceImage(failedUrl, failedUrl)).toBe(false);
		expect(
			shouldShowAnimationSourceImage(
				"https://assets.example.com/source-v2.png",
				failedUrl,
			),
		).toBe(true);
		expect(shouldShowAnimationSourceImage(null, failedUrl)).toBe(false);
	});
});
