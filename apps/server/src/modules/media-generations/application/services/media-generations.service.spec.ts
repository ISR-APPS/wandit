import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getObjectContentType,
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
	aspect: "9:16",
	completedAt: null,
	createdAt: new Date("2026-07-24T10:00:00.000Z"),
	durationSeconds: 5,
	error: null,
	id: "11111111-1111-4111-8111-111111111111",
	kind: "image-animation",
	motion: "balanced",
	projectId: "22222222-2222-4222-8222-222222222222",
	prompt: "A slow camera push.",
	sourceImageUrl:
		"https://assets.example.com/uploads/user_1/upload_1/product.png",
	sourceMediaType: "image/png",
	startedAt: null,
	status: "queued",
	title: null,
	videoMediaType: null,
	videoUrl: null,
	voiceover: null,
};

function setup() {
	const repository = {
		findAccessibleAttempt: vi.fn(),
		markGeneratingAttemptSucceeded: vi.fn(),
		markStaleGeneratingAttemptFailed: vi.fn(),
		markStaleQueuedAttemptFailed: vi.fn(),
	};
	const usageEvent = { id: "usage_event_1", operation: "video" } as Awaited<
		ReturnType<MeteringService["reserve"]>
	>;
	const meteringService = {
		findByIdempotencyKey: vi.fn().mockResolvedValue(usageEvent),
		refund: vi.fn().mockResolvedValue(usageEvent),
		settleMeasuredFromEvidence: vi.fn().mockResolvedValue(usageEvent),
	};
	const service = new MediaGenerationsService(
		repository as unknown as MediaGenerationsRepository,
		meteringService as unknown as MeteringService,
	);

	return { meteringService, repository, service };
}

beforeEach(() => {
	vi.mocked(getObjectContentType).mockReset();
	vi.mocked(getObjectContentType).mockResolvedValue(null);
	vi.mocked(publicAssetUrl).mockClear();
	vi.mocked(siteVideoKey).mockClear();
});

describe("MediaGenerationsService", () => {
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
		expect(meteringService.settleMeasuredFromEvidence).toHaveBeenCalledWith(
			"usage_event_1",
			1,
		);
		expect(
			meteringService.settleMeasuredFromEvidence.mock
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
		meteringService.settleMeasuredFromEvidence.mockRejectedValueOnce(
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
		expect(meteringService.settleMeasuredFromEvidence).not.toHaveBeenCalled();
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

	it("does not reveal an unknown or unowned attempt", async () => {
		const { repository, service } = setup();
		repository.findAccessibleAttempt.mockResolvedValue(null);

		await expect(service.attempt(SCOPE, "unknown")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});
