import type { ImageGenerationAttempt } from "@wandit/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			const value =
				key === "workspace.chat.generateImage.readyCount"
					? "{ready} of {total} ready"
					: key;

			return value.replace(/\{(\w+)\}/g, (_, name: string) =>
				String(params?.[name] ?? `{${name}}`),
			);
		},
	}),
}));

vi.mock("./chat-media", () => ({
	ChatMediaGallery: ({
		items,
	}: {
		items: Array<{ downloadUrl?: string; key: string; label: string }>;
	}) =>
		createElement(
			"div",
			{ "data-gallery": true },
			items.map((item) =>
				createElement("a", {
					"aria-label": item.label,
					href: item.downloadUrl,
					key: item.key,
				}),
			),
		),
}));

import {
	ImageGenerationAttemptView,
	ImageGenerationResult,
} from "./generate-image-part";

function attempt(
	overrides: Partial<ImageGenerationAttempt> = {},
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
		placement: undefined,
		error: null,
		createdAt: "2026-08-01T10:00:00.000Z",
		completedAt: "2026-08-01T10:01:00.000Z",
		...overrides,
	};
}

function renderAttempt(overrides: Partial<ImageGenerationAttempt>): string {
	return renderToStaticMarkup(
		createElement(ImageGenerationAttemptView, {
			attempt: attempt(overrides),
		}),
	);
}

describe("ImageGenerationAttemptView", () => {
	it("renders zero of four ready as four fixed-aspect skeleton slots", () => {
		const html = renderAttempt({
			completedAt: null,
			count: 4,
			images: [],
			status: "generating",
		});

		expect(html.match(/data-slot="skeleton"/g)).toHaveLength(4);
		expect(html.match(/aspect-square/g)).toHaveLength(4);
		expect(html).toContain("0 of 4 ready");
		expect(html).not.toContain("<img");
	});

	it("fills completed slots while preserving the remaining skeletons", () => {
		const html = renderAttempt({
			completedAt: null,
			count: 4,
			images: [
				{
					mediaType: "image/png",
					url: "https://assets.example.com/generated-1.png",
				},
				{
					mediaType: "image/png",
					url: "https://assets.example.com/generated-2.png",
				},
			],
			status: "generating",
		});

		expect(html.match(/data-slot="skeleton"/g)).toHaveLength(2);
		expect(html.match(/<img/g)).toHaveLength(2);
		expect(html).toContain('href="https://assets.example.com/generated-1.png"');
		expect(html).toContain('href="https://assets.example.com/generated-2.png"');
		expect(html).toContain("2 of 4 ready");
	});

	it("places a sparse indexed partial image in its generation slot", () => {
		const imageUrl = "https://assets.example.com/generated-2.png";
		const html = renderAttempt({
			completedAt: null,
			count: 2,
			images: [
				{
					index: 2,
					mediaType: "image/png",
					url: imageUrl,
				},
			],
			status: "generating",
		});
		const skeletonPosition = html.indexOf('data-slot="skeleton"');
		const imagePosition = html.indexOf(`<a href="${imageUrl}"`);

		expect(html.match(/data-slot="skeleton"/g)).toHaveLength(1);
		expect(skeletonPosition).toBeGreaterThan(-1);
		expect(imagePosition).toBeGreaterThan(skeletonPosition);
		expect(html).toContain('alt="Product image 2"');
	});

	it("keeps the old-server generating state unchanged when images is null", () => {
		const html = renderAttempt({
			completedAt: null,
			count: 4,
			images: null,
			status: "generating",
		});

		expect(html.match(/data-slot="skeleton"/g)).toHaveLength(4);
		expect(html).not.toContain("of 4 ready");
		expect(html).not.toContain("workspace.chat.generateImage.readyCount");
	});

	it("uses partial slots from a queued response when the server provides them", () => {
		const html = renderAttempt({
			completedAt: null,
			count: 4,
			images: [
				{
					mediaType: "image/png",
					url: "https://assets.example.com/queued-1.png",
				},
			],
			status: "queued",
		});

		expect(html.match(/data-slot="skeleton"/g)).toHaveLength(3);
		expect(html).toContain('href="https://assets.example.com/queued-1.png"');
		expect(html).toContain("1 of 4 ready");
	});

	it("keeps succeeded and failed attempts on their terminal views", () => {
		const succeeded = renderAttempt({ status: "succeeded" });
		expect(succeeded).toContain('data-gallery="true"');
		expect(succeeded).not.toContain('data-slot="skeleton"');

		const failed = renderAttempt({
			completedAt: "2026-08-01T10:00:30.000Z",
			error: "The provider rejected this image request.",
			images: null,
			status: "failed",
		});
		expect(failed).toContain("The provider rejected this image request.");
		expect(failed).not.toContain('data-slot="skeleton"');
	});

	it("falls back to generic failure copy when the server has no error", () => {
		const html = renderAttempt({
			error: null,
			images: null,
			status: "failed",
		});

		expect(html).toContain("workspace.chat.generateImage.failedBody");
	});
});

describe("ImageGenerationResult", () => {
	it("uses sparse generation indexes for labels and download URLs", () => {
		const html = renderToStaticMarkup(
			createElement(ImageGenerationResult, {
				attempt: attempt({
					count: 3,
					images: [
						{
							index: 2,
							mediaType: "image/png",
							url: "https://assets.example.com/generated-2.png",
						},
						{
							index: 3,
							mediaType: "image/png",
							url: "https://assets.example.com/generated-3.png",
						},
					],
				}),
			}),
		);

		expect(html).toContain(
			"/api/v1/image-generations/00000000-0000-4000-8000-000000000001/download/2",
		);
		expect(html).toContain(
			"/api/v1/image-generations/00000000-0000-4000-8000-000000000001/download/3",
		);
		expect(html).not.toContain(
			"/api/v1/image-generations/00000000-0000-4000-8000-000000000001/download/1",
		);
		expect(html).toContain('aria-label="Product image 2"');
		expect(html).toContain('aria-label="Product image 3"');
	});

	it("shows a localized note only when page placement failed", () => {
		const failed = renderToStaticMarkup(
			createElement(ImageGenerationResult, {
				attempt: attempt({ placement: { status: "failed" } }),
			}),
		);
		expect(failed).toContain("workspace.chat.generateImage.placementFailed");

		for (const placement of [{ status: "applied" } as const, undefined]) {
			const html = renderToStaticMarkup(
				createElement(ImageGenerationResult, {
					attempt: attempt({ placement }),
				}),
			);
			expect(html).not.toContain(
				"workspace.chat.generateImage.placementFailed",
			);
		}
	});
});
