import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getObjectBytes,
	getObjectContentType,
	publicAssetKeyFromUrl,
	publicAssetUrl,
	siteVideoKey,
} from "../../../../infrastructure/storage/r2";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	MediaGenerationAttemptRow,
	MediaGenerationsRepository,
} from "../../infrastructure/persistence/media-generations.repository";
import { MediaGenerationsService } from "./media-generations.service";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	getObjectBytes: vi.fn(),
	getObjectContentType: vi.fn(),
	publicAssetKeyFromUrl: vi.fn(),
	publicAssetUrl: vi.fn((key: string) => `https://assets.example.com/${key}`),
	siteVideoKey: vi.fn(
		(projectId: string, attemptId: string, index: number, extension: string) =>
			`sites/${projectId}/assets/${attemptId}/vid-${index}.${extension}`,
	),
}));

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

const SCOPE: ProjectScope = { kind: "personal", userId: "user_1" };

const BASE_ROW: MediaGenerationAttemptRow = {
	actualDurationMs: null,
	aspect: "9:16",
	chainDepth: 0,
	completedAt: null,
	createdAt: new Date("2026-07-24T10:00:00.000Z"),
	durationSeconds: 5,
	error: null,
	id: "11111111-1111-4111-8111-111111111111",
	kind: "image-animation",
	model: "klingai/kling-v2.6-i2v",
	motion: "balanced",
	projectId: "22222222-2222-4222-8222-222222222222",
	prompt: "A slow camera push.",
	quality: "standard",
	sourceAttemptId: null,
	sourceDurationMs: null,
	sourceImageUrl:
		"https://assets.example.com/uploads/user_1/upload_1/product.png",
	sourceMediaType: "image/png",
	sourceVideoMediaType: null,
	sourceVideoUrl: null,
	startedAt: null,
	status: "queued",
	talking: false,
	title: null,
	videoMediaType: null,
	videoUrl: null,
	voiceover: null,
};

function setup() {
	const repository = {
		findAccessibleAttempt: vi.fn(),
		latestLegActivityAt: vi.fn().mockResolvedValue(null),
		listLegs: vi.fn().mockResolvedValue([]),
		markGeneratingAttemptSucceeded: vi.fn(),
		markStaleGeneratingAttemptFailed: vi.fn(),
		markStaleQueuedAttemptFailed: vi.fn(),
		providerEvidenceUnits: vi.fn().mockResolvedValue(0),
	};
	const usageEvent = { id: "usage_event_1", operation: "video" } as Awaited<
		ReturnType<MeteringService["reserve"]>
	>;
	const meteringService = {
		findByIdempotencyKey: vi.fn().mockResolvedValue(usageEvent),
		refund: vi.fn().mockResolvedValue(usageEvent),
		settleFixedFromEvidence: vi.fn().mockResolvedValue(usageEvent),
	};
	const service = new MediaGenerationsService(
		repository as unknown as MediaGenerationsRepository,
		meteringService as unknown as MeteringService,
	);

	return { meteringService, repository, service };
}

beforeEach(() => {
	vi.mocked(getObjectBytes).mockReset();
	vi.mocked(getObjectBytes).mockResolvedValue(new Uint8Array([1, 2, 3]));
	vi.mocked(getObjectContentType).mockReset();
	vi.mocked(getObjectContentType).mockResolvedValue(null);
	vi.mocked(publicAssetKeyFromUrl).mockReset();
	vi.mocked(publicAssetKeyFromUrl).mockReturnValue("videos/result.mp4");
	vi.mocked(publicAssetUrl).mockClear();
	vi.mocked(siteVideoKey).mockClear();
});

describe("MediaGenerationsService", () => {
	it("maps a max-tier 15-second duration without truncating it", async () => {
		const { repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			durationSeconds: 15,
			kind: "text-to-video",
			model: "klingai/kling-v3.0-t2v",
			motion: null,
			quality: "max",
			sourceImageUrl: null,
			sourceMediaType: null,
		});

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			durationSeconds: 15,
			kind: "text-to-video",
		});
	});

	it.each([
		20, 30,
	])("maps a %i-second joined result duration without truncating it", async (durationSeconds) => {
		const { repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			durationSeconds,
			kind: "video-extension",
			motion: null,
			sourceImageUrl: null,
			sourceMediaType: null,
		});

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			durationSeconds,
			kind: "video-extension",
		});
	});

	it("settles captured edit evidence instead of refunding a failed delivery", async () => {
		const { meteringService, repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			completedAt: new Date(),
			error: "Delivery failed after the provider completed.",
			kind: "video-edit",
			status: "failed",
		});
		repository.providerEvidenceUnits.mockResolvedValue(1);

		await service.attempt(SCOPE, BASE_ROW.id);

		expect(meteringService.settleFixedFromEvidence).toHaveBeenCalledWith(
			"usage_event_1",
			1,
		);
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("prefers the rounded probed duration without clamping it", async () => {
		const { repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			actualDurationMs: 44_601,
			durationSeconds: 30,
			kind: "video-extension",
		});

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			durationSeconds: 45,
		});
	});

	it("leaves a recently queued Trigger handoff active", async () => {
		const { meteringService, repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			createdAt: new Date(Date.now() - 5 * 60 * 1_000),
		});

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			id: BASE_ROW.id,
			status: "queued",
		});
		expect(repository.markStaleQueuedAttemptFailed).not.toHaveBeenCalled();
		expect(repository.markStaleGeneratingAttemptFailed).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("fails an abandoned queued Trigger handoff after the grace window", async () => {
		const { meteringService, repository, service } = setup();
		const staleRow = {
			...BASE_ROW,
			createdAt: new Date(Date.now() - 45 * 60 * 1_000),
		};
		const failedRow = {
			...staleRow,
			completedAt: new Date(),
			error:
				"The video request did not reach the background generator. Please try again.",
			status: "failed" as const,
		};
		repository.findAccessibleAttempt
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(failedRow);
		repository.markStaleQueuedAttemptFailed.mockResolvedValue(true);

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			error: failedRow.error,
			id: BASE_ROW.id,
			status: "failed",
		});
		expect(repository.markStaleQueuedAttemptFailed).toHaveBeenCalledWith(
			BASE_ROW.id,
			expect.any(Date),
			failedRow.error,
			"user_1",
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"image_animation_failed",
		);
	});

	it("fails and refunds only a generation whose worker start is stale", async () => {
		const { meteringService, repository, service } = setup();
		const staleStartedAt = new Date(Date.now() - 20 * 60 * 1_000);
		const staleRow = {
			...BASE_ROW,
			startedAt: staleStartedAt,
			status: "generating" as const,
		};
		const failedRow = {
			...staleRow,
			completedAt: new Date(),
			error: "The video did not finish. Please try again.",
			status: "failed" as const,
		};
		repository.findAccessibleAttempt
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(failedRow);
		repository.markStaleGeneratingAttemptFailed.mockResolvedValue(true);

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			error: failedRow.error,
			id: BASE_ROW.id,
			status: "failed",
		});
		expect(repository.markStaleGeneratingAttemptFailed).toHaveBeenCalledWith(
			BASE_ROW.id,
			expect.any(Date),
			failedRow.error,
			"user_1",
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"image_animation_failed",
		);
	});

	it("leaves a recently claimed generation active", async () => {
		const { meteringService, repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			startedAt: new Date(Date.now() - 60 * 1_000),
			status: "generating",
		});

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			id: BASE_ROW.id,
			status: "generating",
		});
		expect(repository.markStaleGeneratingAttemptFailed).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it.each([
		["video-edit", 19],
		["video-extension", 34],
	] as const)("keeps a %s attempt active inside its kind-specific stale window", async (kind, ageMinutes) => {
		const { meteringService, repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			kind,
			startedAt: new Date(Date.now() - ageMinutes * 60 * 1_000),
			status: "generating",
		});

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			kind,
			status: "generating",
		});
		expect(repository.markStaleGeneratingAttemptFailed).not.toHaveBeenCalled();
		expect(repository.markGeneratingAttemptSucceeded).not.toHaveBeenCalled();
		expect(meteringService.settleFixedFromEvidence).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("keeps an old extension active when a leg completed ten minutes ago", async () => {
		const { meteringService, repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			kind: "video-extension",
			startedAt: new Date(Date.now() - 50 * 60 * 1_000),
			status: "generating",
		});
		repository.latestLegActivityAt.mockResolvedValue(
			new Date(Date.now() - 10 * 60 * 1_000),
		);

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			kind: "video-extension",
			status: "generating",
		});
		expect(repository.latestLegActivityAt).toHaveBeenCalledWith(BASE_ROW.id);
		expect(repository.markStaleGeneratingAttemptFailed).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it.each([
		["video-edit", 21, "video_edit_failed"],
	] as const)("fails a stale %s attempt only after its own window", async (kind, ageMinutes, refundReason) => {
		const { meteringService, repository, service } = setup();
		const staleRow = {
			...BASE_ROW,
			kind,
			startedAt: new Date(Date.now() - ageMinutes * 60 * 1_000),
			status: "generating" as const,
		};
		const failedRow = {
			...staleRow,
			completedAt: new Date(),
			error: "The video did not finish. Please try again.",
			status: "failed" as const,
		};
		repository.findAccessibleAttempt
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(failedRow);
		repository.markStaleGeneratingAttemptFailed.mockResolvedValue(true);

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			kind,
			status: "failed",
		});
		expect(repository.markStaleGeneratingAttemptFailed).toHaveBeenCalledWith(
			BASE_ROW.id,
			expect.any(Date),
			failedRow.error,
			"user_1",
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			refundReason,
		);
	});

	it("fails an extension with no leg activity for 36 minutes", async () => {
		const { meteringService, repository, service } = setup();
		const staleRow = {
			...BASE_ROW,
			kind: "video-extension" as const,
			startedAt: new Date(Date.now() - 36 * 60 * 1_000),
			status: "generating" as const,
		};
		const failedRow = {
			...staleRow,
			completedAt: new Date(),
			error: "The video did not finish. Please try again.",
			status: "failed" as const,
		};
		repository.findAccessibleAttempt
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(failedRow);
		repository.latestLegActivityAt.mockResolvedValue(null);
		repository.markStaleGeneratingAttemptFailed.mockResolvedValue(true);

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			kind: "video-extension",
			status: "failed",
		});
		expect(repository.latestLegActivityAt).toHaveBeenCalledWith(BASE_ROW.id);
		expect(repository.markStaleGeneratingAttemptFailed).toHaveBeenCalledWith(
			BASE_ROW.id,
			expect.any(Date),
			failedRow.error,
			"user_1",
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"video_extension_failed",
		);
	});

	it("recovers a stored video before expiring a stale generation", async () => {
		const { meteringService, repository, service } = setup();
		const staleRow = {
			...BASE_ROW,
			startedAt: new Date(Date.now() - 20 * 60 * 1_000),
			status: "generating" as const,
		};
		const succeededRow = {
			...staleRow,
			completedAt: new Date(),
			status: "succeeded" as const,
			videoMediaType: "video/mp4",
			videoUrl:
				"https://assets.example.com/sites/project/assets/attempt/vid-1.mp4",
		};
		repository.findAccessibleAttempt
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(succeededRow);
		repository.markGeneratingAttemptSucceeded.mockResolvedValue(true);
		vi.mocked(getObjectContentType).mockResolvedValueOnce("video/mp4");

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			status: "succeeded",
			videoMediaType: "video/mp4",
		});
		expect(repository.markGeneratingAttemptSucceeded).toHaveBeenCalledWith(
			BASE_ROW.id,
			expect.stringContaining("vid-1.mp4"),
			"video/mp4",
			"user_1",
		);
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			`video:${BASE_ROW.id}`,
			{ actorUserId: "user_1" },
		);
		expect(meteringService.settleFixedFromEvidence).toHaveBeenCalledWith(
			"usage_event_1",
			1,
		);
		expect(
			meteringService.settleFixedFromEvidence.mock
				.invocationCallOrder[0] as number,
		).toBeLessThan(
			repository.markGeneratingAttemptSucceeded.mock
				.invocationCallOrder[0] as number,
		);
		expect(repository.markStaleGeneratingAttemptFailed).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("does not publish a recovered video when existing settlement fails", async () => {
		const { meteringService, repository, service } = setup();
		const staleRow = {
			...BASE_ROW,
			startedAt: new Date(Date.now() - 20 * 60 * 1_000),
			status: "generating" as const,
		};
		const settlementError = new Error("settlement unavailable");
		repository.findAccessibleAttempt.mockResolvedValue(staleRow);
		vi.mocked(getObjectContentType).mockResolvedValueOnce("video/mp4");
		meteringService.settleFixedFromEvidence.mockRejectedValueOnce(
			settlementError,
		);

		await expect(service.attempt(SCOPE, BASE_ROW.id)).rejects.toBe(
			settlementError,
		);
		expect(repository.markGeneratingAttemptSucceeded).not.toHaveBeenCalled();
		expect(repository.markStaleGeneratingAttemptFailed).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("recovers a legacy stored video without fabricating a new reservation", async () => {
		const { meteringService, repository, service } = setup();
		const staleRow = {
			...BASE_ROW,
			startedAt: new Date(Date.now() - 20 * 60 * 1_000),
			status: "generating" as const,
		};
		const succeededRow = {
			...staleRow,
			completedAt: new Date(),
			status: "succeeded" as const,
			videoMediaType: "video/mp4",
			videoUrl: "https://assets.example.com/recovered.mp4",
		};
		repository.findAccessibleAttempt
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(succeededRow);
		repository.markGeneratingAttemptSucceeded.mockResolvedValue(true);
		vi.mocked(getObjectContentType).mockResolvedValueOnce("video/mp4");
		meteringService.findByIdempotencyKey.mockResolvedValueOnce(null);

		await expect(service.attempt(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			status: "succeeded",
		});
		expect(meteringService.settleFixedFromEvidence).not.toHaveBeenCalled();
		expect(repository.markGeneratingAttemptSucceeded).toHaveBeenCalledTimes(1);
	});

	it("retries the idempotent refund whenever a failed attempt is polled", async () => {
		const { meteringService, repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			completedAt: new Date(),
			error: "Generation failed.",
			status: "failed",
		});

		await service.attempt(SCOPE, BASE_ROW.id);

		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			"image_animation_failed",
		);
	});

	it.each([
		["video-edit", "video_edit_failed"],
		["video-extension", "video_extension_failed"],
	] as const)("uses the %s failure reason when polling", async (kind, reason) => {
		const { meteringService, repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			completedAt: new Date(),
			error: "Generation failed.",
			kind,
			status: "failed",
		});

		await service.attempt(SCOPE, BASE_ROW.id);

		expect(meteringService.refund).toHaveBeenCalledWith(
			"usage_event_1",
			reason,
		);
	});

	it("does not reveal an unknown or unowned attempt", async () => {
		const { repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue(null);

		await expect(service.attempt(SCOPE, "unknown")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it.each([
		["image-animation", "wandit-animation.mp4"],
		["text-to-video", "wandit-video.mp4"],
		["video-edit", "wandit-video-edit.mp4"],
		["video-extension", "wandit-video-extension.mp4"],
	] as const)("uses a kind-aware download name for %s", async (kind, fileName) => {
		const { repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue({
			...BASE_ROW,
			completedAt: new Date(),
			kind,
			startedAt: new Date(),
			status: "succeeded",
			videoMediaType: "video/mp4",
			videoUrl: "https://assets.example.com/videos/result.mp4",
		});

		await expect(service.download(SCOPE, BASE_ROW.id)).resolves.toMatchObject({
			fileName,
		});
	});
});
