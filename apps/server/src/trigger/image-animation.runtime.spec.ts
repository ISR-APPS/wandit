import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getObjectContentType,
	siteVideoKey,
} from "../infrastructure/storage/r2";
import {
	generateBuildVideo,
	generateTextToVideo,
} from "../modules/ai-chat/agent/site-builder/generate-video";
import type { ImageAnimationAttempt } from "../modules/media-generations/application/services/image-animation-runner";
import { runImageAnimation } from "../modules/media-generations/application/services/image-animation-runner";
import { createImageAnimationRuntime } from "./image-animation.runtime";

vi.mock("../modules/ai-chat/agent/site-builder/generate-video", () => ({
	generateBuildVideo: vi.fn(),
	generateTextToVideo: vi.fn(),
	VIDEO_NEGATIVE_PROMPT: "negative prompt",
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

const BASE_ATTEMPT: ImageAnimationAttempt = {
	aspect: "16:9",
	completedAt: null,
	durationSeconds: 5,
	error: null,
	id: "attempt_1",
	kind: "image-animation",
	model: "klingai/kling-v2.6-i2v",
	motion: "balanced",
	organizationId: null,
	projectDeletedAt: null,
	projectId: "project_1",
	prompt: "A gentle camera move",
	quality: "standard",
	sourceImageUrl: "https://assets.example.com/source.jpg",
	startedAt: null,
	status: "generating",
	talking: false,
	triggerRunId: "run_1",
	userId: "project_owner_1",
	videoMediaType: null,
	videoUrl: null,
	voiceover: null,
};

function runtime() {
	return createImageAnimationRuntime(
		{} as Parameters<typeof createImageAnimationRuntime>[0],
		{ capture: vi.fn() },
	);
}

function runtimeWithLoadedRow(row: Record<string, unknown>) {
	const limit = vi.fn().mockResolvedValue([row]);
	const where = vi.fn(() => ({ limit }));
	const innerJoin = vi.fn(() => ({ where }));
	const from = vi.fn(() => ({ innerJoin }));
	const select = vi.fn(() => ({ from }));

	return createImageAnimationRuntime(
		{ select } as unknown as Parameters<typeof createImageAnimationRuntime>[0],
		{ capture: vi.fn() },
	);
}

function runtimeWithReconciliationRows(
	failed: Record<string, unknown>[],
	generating: Record<string, unknown>[],
	queued: Record<string, unknown>[],
) {
	const limit = vi
		.fn()
		.mockResolvedValueOnce(failed)
		.mockResolvedValueOnce(generating)
		.mockResolvedValueOnce(queued);
	const orderBy = vi.fn(() => ({ limit }));
	const where = vi.fn(() => ({ orderBy }));
	const innerJoin = vi.fn(() => ({ where }));
	const from = vi.fn(() => ({ innerJoin }));
	const select = vi.fn(() => ({ from }));

	return createImageAnimationRuntime(
		{ select } as unknown as Parameters<typeof createImageAnimationRuntime>[0],
		{ capture: vi.fn() },
	);
}

beforeEach(() => {
	vi.mocked(getObjectContentType).mockReset();
	vi.mocked(getObjectContentType).mockResolvedValue(null);
	vi.mocked(siteVideoKey).mockClear();
	vi.mocked(generateBuildVideo).mockReset();
	vi.mocked(generateTextToVideo).mockReset();
	vi.mocked(generateBuildVideo).mockResolvedValue({
		mediaType: "video/mp4",
		model: "model",
		providerMetadata: {},
		status: "generated",
		url: "https://assets.example.com/video.mp4",
	});
	vi.mocked(generateTextToVideo).mockResolvedValue({
		mediaType: "video/mp4",
		model: "model",
		providerMetadata: {},
		status: "generated",
		url: "https://assets.example.com/video.mp4",
	});
});

describe("image-animation Trigger runtime", () => {
	it("checks only the final vid-1 recovery keys", async () => {
		const triggerRuntime = runtime();

		await expect(
			triggerRuntime.reconciler.recoverStoredVideo({
				id: "attempt_1",
				projectId: "project_1",
			}),
		).resolves.toBeNull();

		expect(vi.mocked(siteVideoKey).mock.calls).toEqual([
			["project_1", "attempt_1", 1, "mp4"],
			["project_1", "attempt_1", 1, "webm"],
		]);
		expect(
			vi.mocked(getObjectContentType).mock.calls.map(([key]) => key),
		).toEqual([
			"sites/project_1/assets/attempt_1/vid-1.mp4",
			"sites/project_1/assets/attempt_1/vid-1.webm",
		]);
	});

	it("routes every newer video kind through the shared reconciliation ledger", async () => {
		const edit = {
			...BASE_ATTEMPT,
			completedAt: new Date(),
			deliveredUnits: 0,
			kind: "video-edit",
			plannedUnits: 1,
			status: "failed",
		};
		const extension = {
			...BASE_ATTEMPT,
			deliveredUnits: 1,
			kind: "video-extension",
			plannedUnits: 2,
			status: "generating",
		};
		const product = {
			...BASE_ATTEMPT,
			completedAt: new Date(),
			deliveredUnits: 0,
			kind: "video-product",
			plannedUnits: 1,
			status: "failed",
		};
		const triggerRuntime = runtimeWithReconciliationRows(
			[edit, product],
			[extension],
			[],
		);
		const cutoff = new Date("2026-08-21T12:00:00.000Z");

		await expect(
			triggerRuntime.reconciler.listCandidates({
				generatingBefore: {
					"image-animation": cutoff,
					"text-to-video": cutoff,
					"video-edit": cutoff,
					"video-extension": cutoff,
					"video-product": cutoff,
				},
				limit: 100,
				queuedBefore: cutoff,
			}),
		).resolves.toEqual([
			expect.objectContaining({
				kind: "video-edit",
				plannedUnits: 1,
				reconciliationReason: "failed_refund",
			}),
			expect.objectContaining({
				kind: "video-product",
				plannedUnits: 1,
				reconciliationReason: "failed_refund",
			}),
			expect.objectContaining({
				deliveredUnits: 1,
				kind: "video-extension",
				plannedUnits: 2,
				reconciliationReason: "stale_generating",
			}),
		]);
	});

	it.each([
		"video-edit",
		"video-extension",
		"video-product",
	] as const)("rejects %s before the legacy runtime can claim or refund it", async (kind) => {
		const futureAttempt = { ...BASE_ATTEMPT, kind };
		const futureRuntime = runtimeWithLoadedRow(futureAttempt);
		const claimQueued = vi.fn();
		const refund = vi.fn();
		futureRuntime.runner.claimQueued = claimQueued;
		futureRuntime.runner.refund = refund;

		await expect(
			runImageAnimation(
				{
					attemptId: futureAttempt.id,
					projectId: futureAttempt.projectId,
					userId: futureAttempt.userId,
				},
				{ dependencies: futureRuntime.runner, runId: "run_1" },
			),
		).rejects.toThrow(`cannot process ${kind} attempt`);
		expect(claimQueued).not.toHaveBeenCalled();
		expect(refund).not.toHaveBeenCalled();
	});

	it("passes the persisted model, voice-control switch, and 15-second duration through", async () => {
		const attempt: ImageAnimationAttempt = {
			...BASE_ATTEMPT,
			durationSeconds: 15,
			kind: "text-to-video",
			model: "klingai/kling-v3.0-t2v",
			motion: null,
			prompt: "A deliberate three-shot launch film",
			quality: "max",
			sourceImageUrl: null,
			talking: true,
		};

		await runtime().runner.generate(attempt, { actorUserId: "member_1" });

		expect(generateTextToVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				durationSeconds: 15,
				modelId: "klingai/kling-v3.0-t2v",
				voiceControl: true,
			}),
		);
		expect(generateBuildVideo).not.toHaveBeenCalled();
	});

	it("resolves the standard image model for a legacy null-model row", async () => {
		await runtime().runner.generate(
			{ ...BASE_ATTEMPT, model: null, quality: null, talking: null },
			{ actorUserId: "member_1" },
		);

		expect(generateBuildVideo).toHaveBeenCalledWith(
			expect.objectContaining({
				modelId: "klingai/kling-v2.6-i2v",
				voiceControl: false,
			}),
		);
		expect(generateTextToVideo).not.toHaveBeenCalled();
	});

	it("enables native voice control for off-camera narration without marking the attempt talking", async () => {
		const attempt: ImageAnimationAttempt = {
			...BASE_ATTEMPT,
			durationSeconds: 10,
			kind: "text-to-video",
			model: "klingai/kling-v3.0-t2v",
			motion: null,
			sourceImageUrl: null,
			talking: false,
			voiceover: {
				language: "en",
				script: "A calmer way to move through every morning.",
			},
		};

		await runtime().runner.generate(attempt, { actorUserId: "member_1" });

		expect(generateTextToVideo).toHaveBeenCalledWith(
			expect.objectContaining({ voiceControl: true }),
		);
	});

	it("keeps legacy language-only voiceover rows silent", async () => {
		const attempt: ImageAnimationAttempt = {
			...BASE_ATTEMPT,
			durationSeconds: 10,
			kind: "text-to-video",
			model: "klingai/kling-v2.6-t2v",
			motion: null,
			sourceImageUrl: null,
			talking: false,
			voiceover: { language: "en" },
		};

		await runtime().runner.generate(attempt, { actorUserId: "member_1" });

		expect(generateTextToVideo).toHaveBeenCalledWith(
			expect.objectContaining({ voiceControl: false }),
		);
	});
});
