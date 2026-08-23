import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getObjectContentType,
	siteVideoKey,
} from "../infrastructure/storage/r2";
import { productVideo } from "../modules/ai-chat/agent/site-builder/product-video";
import type { ProductVideoAttempt } from "../modules/media-generations/application/services/product-video-runner";
import { createProductVideoRuntime } from "./product-video.runtime";

vi.mock("../modules/ai-chat/agent/site-builder/product-video", () => ({
	productVideo: vi.fn(),
}));
vi.mock("../infrastructure/storage/r2", () => ({
	getObjectContentType: vi.fn(),
	publicAssetUrl: vi.fn((key: string) => `https://assets.example.com/${key}`),
	siteVideoKey: vi.fn(
		(projectId: string, attemptId: string, index: number, extension: string) =>
			`sites/${projectId}/assets/${attemptId}/vid-${index}.${extension}`,
	),
}));
vi.mock("./metering.runtime", () => ({
	createTriggerMetering: vi.fn(() => ({})),
}));

const BASE_ATTEMPT: ProductVideoAttempt = {
	aspect: "9:16",
	completedAt: null,
	durationSeconds: 5,
	error: null,
	id: "attempt_1",
	kind: "video-product",
	model: "bytedance/seedance-2.5",
	organizationId: null,
	projectDeletedAt: null,
	projectId: "project_1",
	prompt: "A deterministic product orbit.",
	sourceImageUrl: "https://assets.example.com/product.png",
	sourceMediaType: "image/png",
	startedAt: null,
	status: "generating",
	triggerRunId: "run_1",
	userId: "project_owner_1",
	videoMediaType: null,
	videoUrl: null,
};

function runtime() {
	return createProductVideoRuntime(
		{} as Parameters<typeof createProductVideoRuntime>[0],
		{ capture: vi.fn() },
	);
}

function runtimeWithLoadedRow(row: Record<string, unknown>) {
	const limit = vi.fn().mockResolvedValue([row]);
	const where = vi.fn(() => ({ limit }));
	const innerJoin = vi.fn(() => ({ where }));
	const from = vi.fn(() => ({ innerJoin }));
	const select = vi.fn(() => ({ from }));

	return createProductVideoRuntime(
		{ select } as unknown as Parameters<typeof createProductVideoRuntime>[0],
		{ capture: vi.fn() },
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getObjectContentType).mockResolvedValue(null);
	vi.mocked(productVideo).mockResolvedValue({
		mediaType: "video/mp4",
		model: "bytedance/seedance-2.5",
		providerMetadata: { gateway: { generationId: "generation_1" } },
		status: "generated",
		url: "https://assets.example.com/product-video.mp4",
	});
});

describe("product-video Trigger runtime", () => {
	it("checks only deterministic final video recovery keys", async () => {
		await expect(
			runtime().runner.recoverStoredVideo({
				id: "attempt_1",
				projectId: "project_1",
			}),
		).resolves.toBeNull();

		expect(vi.mocked(siteVideoKey).mock.calls).toEqual([
			["project_1", "attempt_1", 1, "mp4"],
			["project_1", "attempt_1", 1, "webm"],
		]);
	});

	it("passes the immutable prepared source snapshot to the product adapter", async () => {
		const onProviderGeneration = vi.fn();
		const onPublishing = vi.fn();

		await runtime().runner.generate(
			BASE_ATTEMPT,
			{ actorUserId: "member_1", organizationId: "org_1" },
			{ onProviderGeneration, onPublishing },
		);

		expect(productVideo).toHaveBeenCalledWith({
			attemptId: "attempt_1",
			imageUrl: "https://assets.example.com/product.png",
			mediaType: "image/png",
			metering: {
				operation: "video",
				organizationId: "org_1",
				userId: "member_1",
			},
			onProviderGeneration,
			onPublishing,
			outputPath: expect.stringContaining("product-video-output"),
			projectId: "project_1",
			prompt: "A deterministic product orbit.",
		});
	});

	it("loads the durable product aspect", async () => {
		await expect(
			runtimeWithLoadedRow(BASE_ATTEMPT).runner.loadAttempt(BASE_ATTEMPT.id),
		).resolves.toEqual(expect.objectContaining({ aspect: "9:16" }));
	});

	it.each([
		{ ...BASE_ATTEMPT, kind: "image-animation" },
		{ ...BASE_ATTEMPT, kind: "video-edit" },
	])("rejects the foreign $kind before the slim runtime can claim it", async (row) => {
		await expect(
			runtimeWithLoadedRow(row).runner.loadAttempt(row.id),
		).rejects.toThrow(`cannot process ${row.kind} attempt`);
	});

	it.each([
		{ ...BASE_ATTEMPT, durationSeconds: 10 },
		{ ...BASE_ATTEMPT, model: "klingai/kling-v2.6-i2v" },
		{ ...BASE_ATTEMPT, sourceMediaType: "image/webp" },
	])("rejects an invalid durable product snapshot", async (row) => {
		await expect(
			runtimeWithLoadedRow(row).runner.loadAttempt(row.id),
		).rejects.toThrow(/invalid snapshot/);
	});
});
