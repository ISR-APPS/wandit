// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ImageGenerationAttempt } from "@wandit/contracts";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatMediaGalleryItem } from "./chat-media";
import {
	ImageBatchAttemptView,
	type ImageBatchResolvedAttempt,
} from "./image-batch-part";

vi.mock("@/lib/i18n", () => {
	const messages: Record<string, string> = {
		"errors.ai.provider_error":
			"{provider} returned an error. Please try again.",
		"workspace.chat.aiError.kicker.provider": "Provider issue",
		"workspace.chat.aiError.providerFallback": "The AI provider",
		"workspace.chat.generateImage.failedBody":
			"Generation stopped before the images were ready.",
		"workspace.chat.generateImage.inAssetsTab":
			"Also available in the Assets tab",
		"workspace.chat.generateImage.retry": "Retry",
		"workspace.chat.generateImage.statusLoadError":
			"Could not load the generation status.",
		"workspace.chat.imageBatch.generating": "Generating {count} images",
		"workspace.chat.imageBatch.ready": "{count} images ready",
		"workspace.chat.imageBatch.readyCount": "{ready} of {total} ready",
	};
	const t = (key: string, params?: Record<string, unknown>) =>
		(messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
			String(params?.[name] ?? `{${name}}`),
		);

	return { useTranslation: () => ({ dir: "ltr", locale: "en", t }) };
});

vi.mock("@wandit/internationalization/react", () => ({}));

vi.mock("./generate-image-part", () => ({
	imageGenerationAspectClass: (aspect: string | undefined) =>
		aspect === "1:1"
			? "aspect-square"
			: `aspect-[${(aspect ?? "16:9").replace(":", "/")}]`,
	usePolledImageGenerationAttempt: () => {
		throw new Error("The polling resolver is not used by presentation tests");
	},
}));

vi.mock("./chat-media", () => ({
	ChatMediaGallery: () => null,
	ChatMediaLightbox: ({
		items,
		index,
	}: {
		items: ChatMediaGalleryItem[];
		index: number;
	}) =>
		createElement("div", {
			"data-downloads": items.map((item) => item.downloadUrl).join(","),
			"data-index": index,
			"data-items": items.length,
			"data-testid": "batch-lightbox",
		}),
}));

afterEach(() => cleanup());

function attempt(
	id: string,
	overrides: Partial<ImageGenerationAttempt> = {},
): ImageGenerationAttempt {
	return {
		aspect: "1:1",
		completedAt: null,
		count: 1,
		createdAt: "2026-08-01T10:00:00.000Z",
		error: null,
		id,
		images: [],
		prompt: "A detailed product photograph",
		sourceImageUrls: [],
		status: "generating",
		title: "Product image",
		...overrides,
	};
}

function resolved(
	key: string,
	overrides: Partial<ImageBatchResolvedAttempt> = {},
): ImageBatchResolvedAttempt {
	return {
		aspect: "1:1",
		attemptId: undefined,
		count: 1,
		immediateFailure: undefined,
		key,
		prompt: "A detailed product photograph",
		title: "Product image",
		...overrides,
	};
}

describe("ImageBatchAttemptView", () => {
	it("renders one polite pending card with an aspect-aware compact tile grid", () => {
		const attempts = [
			resolved("prequeue", {
				aspect: "2:3" as const,
				count: 2,
				title: "Portrait concepts",
			}),
			resolved("queued", {
				attempt: attempt("11111111-1111-4111-8111-111111111111"),
			}),
		];
		const { container } = render(
			createElement(ImageBatchAttemptView, { attempts }),
		);

		expect(screen.getByRole("status").textContent).toBe("Generating 3 images");
		expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
		expect(
			container.querySelectorAll('[data-image-batch-tile="pending"]'),
		).toHaveLength(3);
		expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
			3,
		);
		expect(
			container.querySelector(".grid-cols-2.sm\\:grid-cols-3"),
		).not.toBeNull();
		expect(container.querySelectorAll(".aspect-\\[2\\/3\\]")).toHaveLength(2);
		expect(
			screen.getAllByText("Also available in the Assets tab"),
		).toHaveLength(1);
	});

	it("counts terminal partial failures and offers one retry per failed attempt", () => {
		const onPrefill = vi.fn();
		const attempts = [
			resolved("ready", {
				attempt: attempt("11111111-1111-4111-8111-111111111111", {
					completedAt: "2026-08-01T10:01:00.000Z",
					images: [
						{
							index: 1,
							mediaType: "image/png",
							url: "https://assets.example.com/ready.png",
						},
					],
					status: "succeeded",
				}),
			}),
			resolved("failed", {
				attempt: attempt("22222222-2222-4222-8222-222222222222", {
					completedAt: "2026-08-01T10:01:00.000Z",
					count: 2,
					failure: {
						kind: "provider_error",
						moderationStage: null,
						providerLabel: "OpenAI",
						providerMessage: null,
						refunded: null,
						requestId: null,
						retryable: true,
						source: "gateway",
						terminal: true,
					},
					images: null,
					prompt: "Retry this exact failed shot",
					status: "failed",
				}),
			}),
		];
		const { container } = render(
			createElement(ImageBatchAttemptView, { attempts, onPrefill }),
		);

		expect(screen.getByRole("status").textContent).toBe("1 of 3 ready");
		expect(
			container.querySelectorAll('[data-image-batch-tile="ready"]'),
		).toHaveLength(1);
		expect(
			container.querySelectorAll('[data-image-batch-tile="error"]'),
		).toHaveLength(2);
		expect(screen.getAllByRole("button", { name: "Retry" })).toHaveLength(1);

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(onPrefill).toHaveBeenCalledWith("Retry this exact failed shot");
	});

	it("opens every finished batch image in one lightbox with download URLs", () => {
		const attempts = [
			resolved("studio", {
				attempt: attempt("11111111-1111-4111-8111-111111111111", {
					completedAt: "2026-08-01T10:01:00.000Z",
					count: 2,
					images: [
						{
							index: 1,
							mediaType: "image/png",
							url: "https://assets.example.com/studio-1.png",
						},
						{
							index: 2,
							mediaType: "image/png",
							url: "https://assets.example.com/studio-2.png",
						},
					],
					status: "succeeded",
					title: "Studio shot",
				}),
			}),
			resolved("detail", {
				attempt: attempt("22222222-2222-4222-8222-222222222222", {
					completedAt: "2026-08-01T10:01:00.000Z",
					images: [
						{
							index: 1,
							mediaType: "image/webp",
							url: "https://assets.example.com/detail.png",
						},
					],
					status: "succeeded",
					title: "Detail shot",
				}),
			}),
		];
		render(createElement(ImageBatchAttemptView, { attempts }));

		expect(screen.getByRole("status").textContent).toBe("3 images ready");
		fireEvent.click(screen.getByRole("button", { name: "Studio shot 2" }));

		const lightbox = screen.getByTestId("batch-lightbox");
		expect(lightbox.dataset.items).toBe("3");
		expect(lightbox.dataset.index).toBe("1");
		for (const path of [
			"/api/v1/image-generations/11111111-1111-4111-8111-111111111111/download/1",
			"/api/v1/image-generations/11111111-1111-4111-8111-111111111111/download/2",
			"/api/v1/image-generations/22222222-2222-4222-8222-222222222222/download/1",
		]) {
			expect(lightbox.dataset.downloads).toContain(path);
		}
	});
});
