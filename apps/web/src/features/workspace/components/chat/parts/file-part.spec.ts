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
	FilePart,
	getResilientChatImageState,
	ResilientChatFileMediaView,
	type ResilientChatImageState,
	ResilientChatImageView,
} from "./file-part";

const imagePart = {
	type: "file",
	mediaType: "image/png",
	filename: "product photo.png",
	url: "https://assets.example.com/product-photo.png",
} as const;

function renderImageState(
	state: ResilientChatImageState,
	variant: "single" | "grid" = "single",
): string {
	return renderToStaticMarkup(
		createElement(ResilientChatImageView, {
			part: imagePart,
			state,
			variant,
		}),
	);
}

describe("resilient chat image", () => {
	it("tracks load and failure state by URL so a changed source retries", () => {
		const firstUrl = "https://assets.example.com/first.png";
		const replacementUrl = "https://assets.example.com/replacement.png";

		expect(getResilientChatImageState(firstUrl, null, null)).toBe("loading");
		expect(getResilientChatImageState(firstUrl, firstUrl, null)).toBe("loaded");
		expect(getResilientChatImageState(firstUrl, firstUrl, firstUrl)).toBe(
			"failed",
		);
		expect(getResilientChatImageState(replacementUrl, null, firstUrl)).toBe(
			"loading",
		);
	});

	it("reserves the single thumbnail while loading", () => {
		const html = renderImageState("loading");

		expect(html).toContain(
			'class="relative block aspect-[6/5] w-48 max-w-full overflow-hidden rounded-xl border border-border bg-muted"',
		);
		expect(html).toContain('data-slot="skeleton"');
		expect(html).toContain(
			'class="absolute inset-0 size-full object-cover opacity-0"',
		);
		expect(html).toContain(`href="${imagePart.url}"`);
		expect(html).toContain('target="_blank"');
	});

	it("keeps grid thumbnails square and reveals a loaded image", () => {
		const loadingHtml = renderImageState("loading", "grid");
		const loadedHtml = renderImageState("loaded", "grid");

		expect(loadingHtml).toContain(
			'class="relative block aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted"',
		);
		expect(loadedHtml).not.toContain('data-slot="skeleton"');
		expect(loadedHtml).toContain(
			'class="absolute inset-0 size-full object-cover opacity-100"',
		);
	});

	it("replaces a failed image with a localized, clickable filename chip", () => {
		const html = renderImageState("failed");

		expect(html).not.toContain("<img");
		expect(html).toContain(`href="${imagePart.url}"`);
		expect(html).toContain('target="_blank"');
		expect(html).toContain(
			'aria-label="Image failed to load: product photo.png"',
		);
		expect(html).toContain("lucide-image-off");
		expect(html).toContain("product photo.png");
		expect(html).toContain(
			'class="inline-flex h-8 max-w-64 items-center gap-2 rounded-full border border-border bg-muted/60 px-3 text-muted-foreground text-xs transition-colors hover:text-foreground"',
		);
	});
});

describe("uploaded video and audio file parts", () => {
	it("renders an uploaded video with contained controls", () => {
		const html = renderToStaticMarkup(
			createElement(FilePart, {
				part: {
					type: "file",
					mediaType: "video/mp4",
					filename: "reference.mp4",
					url: "https://assets.example.com/reference.mp4",
				},
			}),
		);

		expect(html).toContain("<video");
		expect(html).toContain('controls=""');
		expect(html).toContain('preload="metadata"');
		expect(html).toContain('aria-label="reference.mp4"');
		expect(html).toContain("max-w-xl");
		expect(html).toContain("<track");
	});

	it("renders an uploaded audio file with contained controls", () => {
		const html = renderToStaticMarkup(
			createElement(FilePart, {
				part: {
					type: "file",
					mediaType: "audio/mpeg",
					filename: "soundtrack.mp3",
					url: "https://assets.example.com/soundtrack.mp3",
				},
			}),
		);

		expect(html).toContain("<audio");
		expect(html).toContain('controls=""');
		expect(html).toContain('preload="metadata"');
		expect(html).toContain('aria-label="soundtrack.mp3"');
		expect(html).toContain("max-w-xl");
	});

	it("falls back to the generic file chip when media playback fails", () => {
		const part = {
			type: "file" as const,
			mediaType: "video/webm",
			filename: "broken.webm",
			url: "https://assets.example.com/broken.webm",
		};
		const html = renderToStaticMarkup(
			createElement(ResilientChatFileMediaView, {
				part,
				kind: "video",
				failed: true,
			}),
		);

		expect(html).not.toContain("<video");
		expect(html).toContain(`href="${part.url}"`);
		expect(html).toContain("broken.webm");
		expect(html).toContain("lucide-file-text");
	});
});
