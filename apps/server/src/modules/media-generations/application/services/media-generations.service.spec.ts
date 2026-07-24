import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getObjectContentType,
	publicAssetUrl,
	siteVideoKey,
} from "../../../../infrastructure/storage/r2";
import type { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
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

const BASE_ROW: MediaGenerationAttemptRow = {
	aspect: "9:16",
	completedAt: null,
	createdAt: new Date("2026-07-24T10:00:00.000Z"),
	durationSeconds: 5,
	error: null,
	id: "11111111-1111-4111-8111-111111111111",
	motion: "balanced",
	projectId: "22222222-2222-4222-8222-222222222222",
	prompt: "A slow camera push.",
	sourceImageUrl:
		"https://assets.example.com/uploads/user_1/upload_1/product.png",
	sourceMediaType: "image/png",
	startedAt: null,
	status: "queued",
	videoMediaType: null,
	videoUrl: null,
};

function setup() {
	const repository = {
		findOwnedAttempt: vi.fn(),
		markGeneratingAttemptSucceeded: vi.fn(),
		markStaleGeneratingAttemptFailed: vi.fn(),
		markStaleQueuedAttemptFailed: vi.fn(),
	};
	const generationPolicyService = {
		refundGenerationReservation: vi.fn().mockResolvedValue([]),
	};
	const service = new MediaGenerationsService(
		repository as unknown as MediaGenerationsRepository,
		generationPolicyService as unknown as GenerationPolicyService,
	);

	return { generationPolicyService, repository, service };
}

beforeEach(() => {
	vi.mocked(getObjectContentType).mockReset();
	vi.mocked(getObjectContentType).mockResolvedValue(null);
	vi.mocked(publicAssetUrl).mockClear();
	vi.mocked(siteVideoKey).mockClear();
});

describe("MediaGenerationsService", () => {
	it("leaves a recently queued Trigger handoff active", async () => {
		const { generationPolicyService, repository, service } = setup();
		repository.findOwnedAttempt.mockResolvedValue({
			...BASE_ROW,
			createdAt: new Date(Date.now() - 5 * 60 * 1_000),
		});

		await expect(service.attempt("user_1", BASE_ROW.id)).resolves.toMatchObject(
			{
				id: BASE_ROW.id,
				status: "queued",
			},
		);
		expect(repository.markStaleQueuedAttemptFailed).not.toHaveBeenCalled();
		expect(repository.markStaleGeneratingAttemptFailed).not.toHaveBeenCalled();
		expect(
			generationPolicyService.refundGenerationReservation,
		).not.toHaveBeenCalled();
	});

	it("fails an abandoned queued Trigger handoff after the grace window", async () => {
		const { generationPolicyService, repository, service } = setup();
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
		repository.findOwnedAttempt
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(failedRow);
		repository.markStaleQueuedAttemptFailed.mockResolvedValue(true);

		await expect(service.attempt("user_1", BASE_ROW.id)).resolves.toMatchObject(
			{
				error: failedRow.error,
				id: BASE_ROW.id,
				status: "failed",
			},
		);
		expect(repository.markStaleQueuedAttemptFailed).toHaveBeenCalledWith(
			BASE_ROW.id,
			expect.any(Date),
			failedRow.error,
		);
		expect(
			generationPolicyService.refundGenerationReservation,
		).toHaveBeenCalledWith("user_1", BASE_ROW.id);
	});

	it("fails and refunds only a generation whose worker start is stale", async () => {
		const { generationPolicyService, repository, service } = setup();
		const staleStartedAt = new Date(Date.now() - 20 * 60 * 1_000);
		const staleRow = {
			...BASE_ROW,
			startedAt: staleStartedAt,
			status: "generating" as const,
		};
		const failedRow = {
			...staleRow,
			completedAt: new Date(),
			error: "The video did not finish. Please try animating the image again.",
			status: "failed" as const,
		};
		repository.findOwnedAttempt
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(failedRow);
		repository.markStaleGeneratingAttemptFailed.mockResolvedValue(true);

		await expect(service.attempt("user_1", BASE_ROW.id)).resolves.toMatchObject(
			{
				error: failedRow.error,
				id: BASE_ROW.id,
				status: "failed",
			},
		);
		expect(repository.markStaleGeneratingAttemptFailed).toHaveBeenCalledWith(
			BASE_ROW.id,
			expect.any(Date),
			failedRow.error,
		);
		expect(
			generationPolicyService.refundGenerationReservation,
		).toHaveBeenCalledWith("user_1", BASE_ROW.id);
	});

	it("leaves a recently claimed generation active", async () => {
		const { generationPolicyService, repository, service } = setup();
		repository.findOwnedAttempt.mockResolvedValue({
			...BASE_ROW,
			startedAt: new Date(Date.now() - 60 * 1_000),
			status: "generating",
		});

		await expect(service.attempt("user_1", BASE_ROW.id)).resolves.toMatchObject(
			{
				id: BASE_ROW.id,
				status: "generating",
			},
		);
		expect(repository.markStaleGeneratingAttemptFailed).not.toHaveBeenCalled();
		expect(
			generationPolicyService.refundGenerationReservation,
		).not.toHaveBeenCalled();
	});

	it("recovers a stored video before expiring a stale generation", async () => {
		const { generationPolicyService, repository, service } = setup();
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
		repository.findOwnedAttempt
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(succeededRow);
		repository.markGeneratingAttemptSucceeded.mockResolvedValue(true);
		vi.mocked(getObjectContentType).mockResolvedValueOnce("video/mp4");

		await expect(service.attempt("user_1", BASE_ROW.id)).resolves.toMatchObject(
			{
				status: "succeeded",
				videoMediaType: "video/mp4",
			},
		);
		expect(repository.markGeneratingAttemptSucceeded).toHaveBeenCalledWith(
			BASE_ROW.id,
			expect.stringContaining("vid-1.mp4"),
			"video/mp4",
		);
		expect(repository.markStaleGeneratingAttemptFailed).not.toHaveBeenCalled();
		expect(
			generationPolicyService.refundGenerationReservation,
		).not.toHaveBeenCalled();
	});

	it("retries the idempotent refund whenever a failed attempt is polled", async () => {
		const { generationPolicyService, repository, service } = setup();
		repository.findOwnedAttempt.mockResolvedValue({
			...BASE_ROW,
			completedAt: new Date(),
			error: "Generation failed.",
			status: "failed",
		});

		await service.attempt("user_1", BASE_ROW.id);

		expect(
			generationPolicyService.refundGenerationReservation,
		).toHaveBeenCalledWith("user_1", BASE_ROW.id);
	});

	it("does not reveal an unknown or unowned attempt", async () => {
		const { repository, service } = setup();
		repository.findOwnedAttempt.mockResolvedValue(null);

		await expect(service.attempt("user_1", "unknown")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});
});
