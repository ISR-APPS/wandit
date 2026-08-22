import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			key === "workspace.chat.media.imageLoadError"
				? "Image failed to load"
				: key,
	}),
}));

import {
	type ChatMediaGalleryItem,
	ChatMediaImageView,
	getChatMediaImageStatus,
} from "./chat-media";

const image: ChatMediaGalleryItem = {
	key: "image-1",
	kind: "image",
	url: "https://assets.example.com/image.png",
	label: "Product preview.png",
};

function renderImage(
	status: "loading" | "loaded" | "failed",
	variant: "single" | "filmstrip" | "lightbox" = "single",
): string {
	return renderToStaticMarkup(
		createElement(ChatMediaImageView, { item: image, status, variant }),
	);
}

describe("chat media image state", () => {
	it("moves from a reserved loading image to the loaded image", () => {
		const loading = renderImage("loading");
		expect(loading).toContain('data-slot="skeleton"');
		expect(loading).toContain('aria-busy="true"');
		expect(loading).toContain("aspect-video min-h-40 max-h-80 w-full");
		expect(loading).toContain("absolute inset-0 size-full object-contain");
		expect(loading).toContain("opacity-0");

		const loaded = renderImage("loaded");
		expect(loaded).not.toContain('data-slot="skeleton"');
		expect(loaded).not.toContain('aria-busy="true"');
		expect(loaded).toContain("opacity-100");
	});

	it("reserves both height and width for a pending filmstrip image", () => {
		const html = renderImage("loading", "filmstrip");

		expect(html).toContain("h-52 min-w-52 w-auto max-w-80 shrink-0");
		expect(html).toContain("h-full w-auto min-w-52 max-w-80");
	});

	it("replaces a failed image with a same-size link and its label", () => {
		const filmstrip = renderImage("failed", "filmstrip");

		expect(filmstrip).toContain('href="https://assets.example.com/image.png"');
		expect(filmstrip).toContain('target="_blank"');
		expect(filmstrip).toContain("Product preview.png");
		expect(filmstrip).toContain("Image failed to load");
		expect(filmstrip).toContain("h-52 min-w-52 w-auto max-w-80 shrink-0");
		expect(filmstrip).not.toContain("<img");

		const lightbox = renderImage("failed", "lightbox");
		expect(lightbox).toContain(
			"aspect-video max-h-full min-h-0 min-w-0 w-full max-w-5xl flex-1",
		);
		expect(lightbox).toContain('href="https://assets.example.com/image.png"');
	});

	it("retries when the source URL changes after a failure", () => {
		const failedUrl = "https://assets.example.com/failed.png";

		expect(getChatMediaImageStatus(failedUrl, null, failedUrl)).toBe("failed");
		expect(
			getChatMediaImageStatus(
				"https://assets.example.com/replacement.png",
				null,
				failedUrl,
			),
		).toBe("loading");
		expect(getChatMediaImageStatus(failedUrl, failedUrl, null)).toBe("loaded");
	});
});
