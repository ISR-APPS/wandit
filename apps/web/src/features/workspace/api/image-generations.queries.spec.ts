import type { ImageGenerationAttempt } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { workspaceAssetKeys } from "@/features/assets/api/workspace-assets.queries";
import {
	imageGenerationPollingInterval,
	invalidateCompletedImageGeneration,
} from "./image-generations.queries";
import { pageKeys } from "./pages.queries";
import { projectAssetKeys } from "./project-assets.queries";

function attempt(
	status: ImageGenerationAttempt["status"],
	placement?: ImageGenerationAttempt["placement"],
): ImageGenerationAttempt {
	return {
		aspect: "1:1",
		completedAt: null,
		count: 1,
		createdAt: "2026-08-01T10:00:00.000Z",
		error: null,
		id: "11111111-1111-4111-8111-111111111111",
		images: null,
		placement,
		prompt: "Editorial product image",
		sourceImageUrls: [],
		status,
		title: "Product image",
	};
}

describe("imageGenerationPollingInterval", () => {
	it("keeps polling a succeeded generation until placement settles", () => {
		expect(
			imageGenerationPollingInterval(
				attempt("succeeded", { status: "pending" }),
			),
		).toBe(1500);
		expect(
			imageGenerationPollingInterval(
				attempt("succeeded", { status: "applied" }),
			),
		).toBe(false);
		expect(
			imageGenerationPollingInterval(
				attempt("succeeded", { status: "failed" }),
			),
		).toBe(false);
	});

	it("does not keep a failed generation alive for pending placement", () => {
		expect(
			imageGenerationPollingInterval(attempt("failed", { status: "pending" })),
		).toBe(false);
		expect(imageGenerationPollingInterval(attempt("succeeded"))).toBe(false);
	});
});

describe("invalidateCompletedImageGeneration", () => {
	it("invalidates Assets and both page views after placement applies", () => {
		const invalidateQueries = vi.fn().mockResolvedValue(undefined);

		invalidateCompletedImageGeneration(
			{ invalidateQueries },
			"project-1",
			"applied",
		);

		expect(invalidateQueries.mock.calls).toEqual([
			[{ queryKey: projectAssetKeys.list("project-1") }],
			[{ queryKey: workspaceAssetKeys.all }],
			[{ queryKey: pageKeys.overview("project-1") }],
			[{ queryKey: pageKeys.versions("project-1") }],
		]);
	});

	it.each([
		undefined,
		"pending",
		"failed",
	] as const)("only invalidates Assets when placement is %s", (placementStatus) => {
		const invalidateQueries = vi.fn().mockResolvedValue(undefined);

		invalidateCompletedImageGeneration(
			{ invalidateQueries },
			"project-1",
			placementStatus,
		);

		expect(invalidateQueries).toHaveBeenCalledTimes(2);
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: projectAssetKeys.list("project-1"),
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: workspaceAssetKeys.all,
		});
	});
});
