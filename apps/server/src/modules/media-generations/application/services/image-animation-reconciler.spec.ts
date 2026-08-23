import { describe, expect, it, vi } from "vitest";
import {
	allocateImageAnimationReconciliationCapacity,
	IMAGE_ANIMATION_RECONCILIATION_BATCH_SIZE,
	IMAGE_ANIMATION_RECONCILIATION_STALE_GENERATING_MS,
	IMAGE_ANIMATION_STALE_QUEUED_MS,
	type ImageAnimationReconcilerDependencies,
	type ImageAnimationReconciliationCandidate,
	type MediaGenerationReconciliationAttempt,
	reconcileImageAnimations,
} from "./image-animation-reconciler";
import {
	type ImageAnimationVideo,
	USER_SAFE_IMAGE_ANIMATION_ERROR,
} from "./image-animation-runner";
import { MEDIA_GENERATION_STALE_GENERATING_MS } from "./media-generation-staleness";
import { USER_SAFE_PRODUCT_VIDEO_ERROR } from "./product-video-runner";

const NOW = new Date("2026-07-24T12:00:00.000Z");
const RECOVERED_VIDEO: ImageAnimationVideo = {
	mediaType: "video/mp4",
	url: "https://assets.example.com/sites/project_1/assets/attempt_1/vid-1.mp4",
};
const BASE_ATTEMPT: MediaGenerationReconciliationAttempt = {
	aspect: "9:16",
	completedAt: null,
	durationSeconds: 5,
	deliveredUnits: 0,
	error: null,
	id: "attempt_1",
	kind: "image-animation",
	model: "klingai/kling-v2.6-i2v",
	motion: "balanced",
	organizationId: null,
	projectDeletedAt: null,
	projectId: "project_1",
	prompt: "A slow camera push.",
	plannedUnits: 1,
	quality: "standard",
	sourceImageUrl: "https://assets.example.com/source.png",
	startedAt: new Date(
		NOW.getTime() - IMAGE_ANIMATION_RECONCILIATION_STALE_GENERATING_MS - 1,
	),
	status: "generating",
	talking: false,
	triggerRunId: "run_1",
	userId: "user_1",
	videoMediaType: null,
	videoUrl: null,
	voiceover: null,
};

function candidate(
	reconciliationReason: ImageAnimationReconciliationCandidate["reconciliationReason"],
	overrides: Partial<MediaGenerationReconciliationAttempt> = {},
): ImageAnimationReconciliationCandidate {
	return {
		...BASE_ATTEMPT,
		...overrides,
		reconciliationReason,
	};
}

function setup(candidates: ImageAnimationReconciliationCandidate[]) {
	const failFromStatus = vi
		.fn<ImageAnimationReconcilerDependencies["failFromStatus"]>()
		.mockResolvedValue(true);
	const listCandidates = vi
		.fn<ImageAnimationReconcilerDependencies["listCandidates"]>()
		.mockResolvedValue(candidates);
	const latestLegActivityAt = vi
		.fn<ImageAnimationReconcilerDependencies["latestLegActivityAt"]>()
		.mockResolvedValue(null);
	const markSucceeded = vi
		.fn<ImageAnimationReconcilerDependencies["markSucceeded"]>()
		.mockResolvedValue(true);
	const now = vi
		.fn<ImageAnimationReconcilerDependencies["now"]>()
		.mockReturnValue(NOW);
	const recoverStoredVideo = vi
		.fn<ImageAnimationReconcilerDependencies["recoverStoredVideo"]>()
		.mockResolvedValue(null);
	const refund = vi
		.fn<ImageAnimationReconcilerDependencies["refund"]>()
		.mockResolvedValue(undefined);
	const settleExisting = vi
		.fn<ImageAnimationReconcilerDependencies["settleExisting"]>()
		.mockResolvedValue(true);
	const dependencies: ImageAnimationReconcilerDependencies = {
		failFromStatus,
		listCandidates,
		latestLegActivityAt,
		markSucceeded,
		now,
		recoverStoredVideo,
		refund,
		settleExisting,
	};

	return {
		dependencies,
		failFromStatus,
		listCandidates,
		latestLegActivityAt,
		markSucceeded,
		recoverStoredVideo,
		refund,
		settleExisting,
	};
}

describe("reconcileImageAnimations", () => {
	it("fails and refunds a stale queued handoff", async () => {
		const staleQueued = candidate("stale_queued", {
			startedAt: null,
			status: "queued",
		});
		const {
			dependencies,
			failFromStatus,
			listCandidates,
			recoverStoredVideo,
			refund,
		} = setup([staleQueued]);

		await expect(reconcileImageAnimations(dependencies)).resolves.toEqual({
			failed: 1,
			recovered: 0,
			refunded: 1,
			scanned: 1,
			skipped: 0,
		});
		expect(listCandidates).toHaveBeenCalledWith({
			generatingBefore: {
				"image-animation": new Date(
					NOW.getTime() -
						MEDIA_GENERATION_STALE_GENERATING_MS["image-animation"],
				),
				"text-to-video": new Date(
					NOW.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS["text-to-video"],
				),
				"video-edit": new Date(
					NOW.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS["video-edit"],
				),
				"video-extension": new Date(
					NOW.getTime() -
						MEDIA_GENERATION_STALE_GENERATING_MS["video-extension"],
				),
				"video-product": new Date(
					NOW.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS["video-product"],
				),
			},
			limit: IMAGE_ANIMATION_RECONCILIATION_BATCH_SIZE,
			queuedBefore: new Date(NOW.getTime() - IMAGE_ANIMATION_STALE_QUEUED_MS),
		});
		expect(recoverStoredVideo).not.toHaveBeenCalled();
		expect(failFromStatus).toHaveBeenCalledWith(staleQueued, {
			completedAt: NOW,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			expectedStatus: "queued",
			reason: "stale_queued",
		});
		expect(refund).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			"image-animation",
		);
	});

	it("recovers a stale generating attempt from its deterministic stored video", async () => {
		const staleGenerating = candidate("stale_generating");
		const {
			dependencies,
			failFromStatus,
			markSucceeded,
			recoverStoredVideo,
			refund,
			settleExisting,
		} = setup([staleGenerating]);
		recoverStoredVideo.mockResolvedValue(RECOVERED_VIDEO);

		await expect(reconcileImageAnimations(dependencies)).resolves.toEqual({
			failed: 0,
			recovered: 1,
			refunded: 0,
			scanned: 1,
			skipped: 0,
		});
		expect(recoverStoredVideo).toHaveBeenCalledWith(staleGenerating);
		expect(markSucceeded).toHaveBeenCalledWith(
			staleGenerating,
			RECOVERED_VIDEO,
			NOW,
		);
		expect(failFromStatus).not.toHaveBeenCalled();
		expect(refund).not.toHaveBeenCalled();
		expect(settleExisting).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			1,
		);
		expect(settleExisting.mock.invocationCallOrder[0]).toBeLessThan(
			markSucceeded.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
	});

	it("recovers a stale product video and settles it before publishing success", async () => {
		const product = candidate("stale_generating", {
			kind: "video-product",
			startedAt: new Date(
				NOW.getTime() -
					MEDIA_GENERATION_STALE_GENERATING_MS["video-product"] -
					1,
			),
		});
		const { dependencies, markSucceeded, recoverStoredVideo, settleExisting } =
			setup([product]);
		recoverStoredVideo.mockResolvedValue(RECOVERED_VIDEO);

		await expect(reconcileImageAnimations(dependencies)).resolves.toMatchObject(
			{
				recovered: 1,
			},
		);
		expect(recoverStoredVideo).toHaveBeenCalledWith(product);
		expect(settleExisting).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			1,
		);
		expect(settleExisting.mock.invocationCallOrder[0]).toBeLessThan(
			markSucceeded.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
	});

	it("recovers a billing-off attempt without creating a hold later", async () => {
		const staleGenerating = candidate("stale_generating");
		const { dependencies, markSucceeded, recoverStoredVideo, settleExisting } =
			setup([staleGenerating]);
		recoverStoredVideo.mockResolvedValue(RECOVERED_VIDEO);
		settleExisting.mockResolvedValue(false);

		await expect(reconcileImageAnimations(dependencies)).resolves.toMatchObject(
			{
				recovered: 1,
			},
		);
		expect(settleExisting).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			1,
		);
		expect(markSucceeded).toHaveBeenCalledWith(
			staleGenerating,
			RECOVERED_VIDEO,
			NOW,
		);
	});

	it("settles every planned extension leg before publishing recovered final output", async () => {
		const extension = candidate("stale_generating", {
			kind: "video-extension",
			plannedUnits: 3,
			startedAt: new Date(
				NOW.getTime() -
					MEDIA_GENERATION_STALE_GENERATING_MS["video-extension"] -
					1,
			),
		});
		const { dependencies, markSucceeded, recoverStoredVideo, settleExisting } =
			setup([extension]);
		recoverStoredVideo.mockResolvedValue(RECOVERED_VIDEO);

		await expect(reconcileImageAnimations(dependencies)).resolves.toMatchObject(
			{
				recovered: 1,
			},
		);
		expect(settleExisting).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			3,
		);
		expect(settleExisting.mock.invocationCallOrder[0]).toBeLessThan(
			markSucceeded.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
	});

	it("settles delivered extension legs and leaves undelivered units uncharged on stale failure", async () => {
		const extension = candidate("stale_generating", {
			deliveredUnits: 2,
			kind: "video-extension",
			plannedUnits: 3,
			startedAt: new Date(
				NOW.getTime() -
					MEDIA_GENERATION_STALE_GENERATING_MS["video-extension"] -
					1,
			),
		});
		const { dependencies, failFromStatus, refund, settleExisting } = setup([
			extension,
		]);

		await expect(reconcileImageAnimations(dependencies)).resolves.toEqual({
			failed: 1,
			recovered: 0,
			refunded: 0,
			scanned: 1,
			skipped: 0,
		});
		expect(failFromStatus).toHaveBeenCalledWith(
			extension,
			expect.objectContaining({
				error:
					"We couldn't finish extending this video. Please try again in a moment.",
			}),
		);
		expect(settleExisting).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			2,
		);
		expect(refund).not.toHaveBeenCalled();
	});

	it("does not reap an old extension with leg activity ten minutes ago", async () => {
		const extension = candidate("stale_generating", {
			kind: "video-extension",
			startedAt: new Date(NOW.getTime() - 50 * 60 * 1_000),
		});
		const {
			dependencies,
			failFromStatus,
			latestLegActivityAt,
			recoverStoredVideo,
			refund,
		} = setup([extension]);
		latestLegActivityAt.mockResolvedValue(
			new Date(NOW.getTime() - 10 * 60 * 1_000),
		);

		await expect(reconcileImageAnimations(dependencies)).resolves.toEqual({
			failed: 0,
			recovered: 0,
			refunded: 0,
			scanned: 1,
			skipped: 1,
		});
		expect(latestLegActivityAt).toHaveBeenCalledWith(extension.id);
		expect(recoverStoredVideo).not.toHaveBeenCalled();
		expect(failFromStatus).not.toHaveBeenCalled();
		expect(refund).not.toHaveBeenCalled();
	});

	it("fails and refunds a stale generating attempt with no stored video", async () => {
		const staleGenerating = candidate("stale_generating");
		const {
			dependencies,
			failFromStatus,
			markSucceeded,
			recoverStoredVideo,
			refund,
		} = setup([staleGenerating]);

		await expect(reconcileImageAnimations(dependencies)).resolves.toEqual({
			failed: 1,
			recovered: 0,
			refunded: 1,
			scanned: 1,
			skipped: 0,
		});
		expect(recoverStoredVideo).toHaveBeenCalledWith(staleGenerating);
		expect(markSucceeded).not.toHaveBeenCalled();
		expect(failFromStatus).toHaveBeenCalledWith(staleGenerating, {
			activityBefore: new Date(
				NOW.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS["image-animation"],
			),
			completedAt: NOW,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			expectedStatus: "generating",
			reason: "stale_generation",
		});
		expect(refund).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			"image-animation",
		);
	});

	it("fails and refunds a stale product video when no final object exists", async () => {
		const product = candidate("stale_generating", {
			kind: "video-product",
			startedAt: new Date(
				NOW.getTime() -
					MEDIA_GENERATION_STALE_GENERATING_MS["video-product"] -
					1,
			),
		});
		const { dependencies, failFromStatus, refund } = setup([product]);

		await expect(reconcileImageAnimations(dependencies)).resolves.toMatchObject(
			{
				failed: 1,
				refunded: 1,
			},
		);
		expect(failFromStatus).toHaveBeenCalledWith(product, {
			activityBefore: new Date(
				NOW.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS["video-product"],
			),
			completedAt: NOW,
			error: USER_SAFE_PRODUCT_VIDEO_ERROR,
			expectedStatus: "generating",
			reason: "stale_generation",
		});
		expect(refund).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			"video-product",
		);
	});

	it("fails and refunds a deleted stale generation before checking recoverable R2", async () => {
		const deletedGenerating = candidate("stale_generating", {
			projectDeletedAt: NOW,
		});
		const {
			dependencies,
			failFromStatus,
			markSucceeded,
			recoverStoredVideo,
			refund,
		} = setup([deletedGenerating]);
		recoverStoredVideo.mockResolvedValue(RECOVERED_VIDEO);

		await expect(reconcileImageAnimations(dependencies)).resolves.toEqual({
			failed: 1,
			recovered: 0,
			refunded: 1,
			scanned: 1,
			skipped: 0,
		});
		expect(recoverStoredVideo).not.toHaveBeenCalled();
		expect(markSucceeded).not.toHaveBeenCalled();
		expect(failFromStatus).toHaveBeenCalledWith(deletedGenerating, {
			completedAt: NOW,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			expectedStatus: "generating",
			reason: "project_deleted",
		});
		expect(refund).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			"image-animation",
		);
	});

	it("settles an outstanding refund for an already failed attempt", async () => {
		const failedRefund = candidate("failed_refund", {
			completedAt: new Date("2026-07-24T11:00:00.000Z"),
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			status: "failed",
		});
		const { dependencies, failFromStatus, recoverStoredVideo, refund } = setup([
			failedRefund,
		]);

		await expect(reconcileImageAnimations(dependencies)).resolves.toEqual({
			failed: 0,
			recovered: 0,
			refunded: 1,
			scanned: 1,
			skipped: 0,
		});
		expect(refund).toHaveBeenCalledWith(
			{ actorUserId: "user_1" },
			"attempt_1",
			"image-animation",
		);
		expect(recoverStoredVideo).not.toHaveBeenCalled();
		expect(failFromStatus).not.toHaveBeenCalled();
	});

	it("counts lost failure and recovery CAS operations as skips", async () => {
		const staleQueued = candidate("stale_queued", {
			id: "attempt_queued",
			startedAt: null,
			status: "queued",
		});
		const staleGenerating = candidate("stale_generating", {
			id: "attempt_generating",
		});
		const {
			dependencies,
			failFromStatus,
			markSucceeded,
			recoverStoredVideo,
			refund,
		} = setup([staleQueued, staleGenerating]);
		failFromStatus.mockResolvedValue(false);
		recoverStoredVideo.mockResolvedValue(RECOVERED_VIDEO);
		markSucceeded.mockResolvedValue(false);

		await expect(reconcileImageAnimations(dependencies)).resolves.toEqual({
			failed: 0,
			recovered: 0,
			refunded: 0,
			scanned: 2,
			skipped: 2,
		});
		expect(refund).not.toHaveBeenCalled();
	});

	it("propagates a transient stored-video lookup failure for task retry", async () => {
		const staleGenerating = candidate("stale_generating");
		const { dependencies, failFromStatus, recoverStoredVideo, refund } = setup([
			staleGenerating,
		]);
		const storageError = new Error("R2 temporarily unavailable");
		recoverStoredVideo.mockRejectedValue(storageError);

		await expect(reconcileImageAnimations(dependencies)).rejects.toBe(
			storageError,
		);
		expect(failFromStatus).not.toHaveBeenCalled();
		expect(refund).not.toHaveBeenCalled();
	});

	it("propagates a transient refund failure for task retry", async () => {
		const failedRefund = candidate("failed_refund", {
			completedAt: new Date("2026-07-24T11:00:00.000Z"),
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			status: "failed",
		});
		const { dependencies, refund } = setup([failedRefund]);
		const refundError = new Error("Credit ledger temporarily unavailable");
		refund.mockRejectedValue(refundError);

		await expect(reconcileImageAnimations(dependencies)).rejects.toBe(
			refundError,
		);
	});

	it("allocates a bounded, fair batch so queued backlog cannot crowd out settlement", () => {
		const capacity = allocateImageAnimationReconciliationCapacity(
			IMAGE_ANIMATION_RECONCILIATION_BATCH_SIZE,
		);

		expect(capacity).toEqual({
			failedRefund: 34,
			staleGenerating: 33,
			staleQueued: 33,
		});
		expect(
			capacity.failedRefund + capacity.staleGenerating + capacity.staleQueued,
		).toBe(IMAGE_ANIMATION_RECONCILIATION_BATCH_SIZE);
	});
});
