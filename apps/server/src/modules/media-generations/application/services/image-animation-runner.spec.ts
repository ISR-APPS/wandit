import { describe, expect, it, vi } from "vitest";

import {
	IMAGE_ANIMATION_STALE_GENERATING_MS,
	type ImageAnimationAttempt,
	type ImageAnimationRunnerDependencies,
	ImageAnimationSettlementPendingError,
	parseImageAnimationPayload,
	runImageAnimation,
	USER_SAFE_IMAGE_ANIMATION_ERROR,
} from "./image-animation-runner";

const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user_123";
const PARENT_EVENT_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-07-24T12:00:00.000Z");
const RESERVATION = {
	credits: 25,
	eventId: "33333333-3333-4333-8333-333333333333",
	operation: "video" as const,
	referenceId: ATTEMPT_ID,
	replay: "none" as const,
	units: 1,
};

describe("parseImageAnimationPayload", () => {
	it("accepts only the exact handoff payload", () => {
		expect(
			parseImageAnimationPayload({
				attemptId: ATTEMPT_ID,
				billingMode: "enforce",
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toEqual({
			attemptId: ATTEMPT_ID,
			billingMode: "enforce",
			projectId: PROJECT_ID,
			userId: USER_ID,
		});
		expect(
			parseImageAnimationPayload({
				attemptId: ATTEMPT_ID,
				billingMode: "enforce",
				parentEventId: PARENT_EVENT_ID,
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toEqual({
			attemptId: ATTEMPT_ID,
			billingMode: "enforce",
			parentEventId: PARENT_EVENT_ID,
			projectId: PROJECT_ID,
			userId: USER_ID,
		});

		expect(() =>
			parseImageAnimationPayload({
				attemptId: ATTEMPT_ID,
				billingMode: "enforce",
				extra: true,
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toThrow(/only attemptId, optional billingMode, optional parentEventId/);
		expect(() =>
			parseImageAnimationPayload({
				attemptId: "not-a-uuid",
				billingMode: "enforce",
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toThrow(/attemptId must be a UUID/);
	});
});

describe("runImageAnimation", () => {
	it("claims queued work, reserves once, and invokes the provider once", async () => {
		const attempt = makeAttempt();
		const dependencies = makeDependencies(attempt);

		const result = await runImageAnimation(payload(), {
			dependencies,
			runId: "run_123",
		});

		expect(result).toEqual({
			mediaType: "video/mp4",
			recovered: false,
			status: "succeeded",
			url: "https://assets.test/video.mp4",
		});
		expect(dependencies.claimQueued).toHaveBeenCalledWith(attempt, {
			runId: "run_123",
			startedAt: NOW,
		});
		expect(dependencies.reserve).toHaveBeenCalledWith(
			USER_ID,
			ATTEMPT_ID,
			undefined,
			"enforce",
		);
		expect(dependencies.generate).toHaveBeenCalledTimes(1);
		expect(dependencies.capture).toHaveBeenCalledTimes(1);
		expect(dependencies.markSucceeded).toHaveBeenCalledTimes(1);
		expect(dependencies.settle).toHaveBeenCalledWith(RESERVATION);
		expect(
			vi.mocked(dependencies.settle).mock.invocationCallOrder[0],
		).toBeLessThan(
			vi.mocked(dependencies.markSucceeded).mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
	});

	it("fails without refund or provider replay after reconcile_failed", async () => {
		const dependencies = makeDependencies(makeAttempt());
		vi.mocked(dependencies.reserve).mockResolvedValue({
			...RESERVATION,
			replay: "reconcile_failed",
		});

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_replay",
			}),
		).resolves.toEqual({ reason: "generation_failed", status: "failed" });
		expect(dependencies.generate).not.toHaveBeenCalled();
		expect(dependencies.markSucceeded).not.toHaveBeenCalled();
		expect(dependencies.refund).not.toHaveBeenCalled();
		expect(dependencies.fail).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ reason: "terminal_billing" }),
		);
	});

	it("fails and refunds exact queued work when its project was soft-deleted", async () => {
		const deleted = makeAttempt({ projectDeletedAt: NOW });
		const dependencies = makeDependencies(deleted);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_deleted",
			}),
		).resolves.toEqual({
			reason: "project_deleted",
			status: "failed",
		});
		expect(dependencies.fail).toHaveBeenCalledWith(deleted, {
			completedAt: NOW,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			expectedStatus: "queued",
			reason: "project_deleted",
		});
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ATTEMPT_ID);
		expect(dependencies.claimQueued).not.toHaveBeenCalled();
		expect(dependencies.reserve).not.toHaveBeenCalled();
		expect(dependencies.generate).not.toHaveBeenCalled();
		expect(dependencies.recoverStoredVideo).not.toHaveBeenCalled();
	});

	it("fails and refunds exact generating work before checking R2 when its project was soft-deleted", async () => {
		const deleted = makeAttempt({
			projectDeletedAt: NOW,
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
		});
		const dependencies = makeDependencies(deleted, {
			recovered: {
				mediaType: "video/mp4",
				url: "https://assets.test/recovered.mp4",
			},
		});

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_deleted",
			}),
		).resolves.toEqual({
			reason: "project_deleted",
			status: "failed",
		});
		expect(dependencies.fail).toHaveBeenCalledWith(deleted, {
			completedAt: NOW,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			expectedStatus: "generating",
			reason: "project_deleted",
		});
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ATTEMPT_ID);
		expect(dependencies.recoverStoredVideo).not.toHaveBeenCalled();
		expect(dependencies.generate).not.toHaveBeenCalled();
	});

	it("does not refund a succeeded attempt merely because its project was deleted later", async () => {
		const succeeded = makeAttempt({
			completedAt: NOW,
			projectDeletedAt: NOW,
			status: "succeeded",
			videoMediaType: "video/mp4",
			videoUrl: "https://assets.test/video.mp4",
		});
		const dependencies = makeDependencies(succeeded);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_after_delete",
			}),
		).resolves.toMatchObject({ status: "succeeded" });
		expect(dependencies.fail).not.toHaveBeenCalled();
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("preserves the settled charge when deletion wins the provider success CAS", async () => {
		const queued = makeAttempt();
		const deletedGenerating = makeAttempt({
			projectDeletedAt: NOW,
			startedAt: NOW,
			status: "generating",
			triggerRunId: "run_direct",
		});
		const dependencies = makeDependencies(queued);
		vi.mocked(dependencies.loadAttempt)
			.mockResolvedValueOnce(queued)
			.mockResolvedValueOnce(deletedGenerating);
		vi.mocked(dependencies.markSucceeded).mockResolvedValueOnce(false);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_direct",
			}),
		).resolves.toEqual({
			reason: "project_deleted",
			status: "failed",
		});
		expect(dependencies.generate).toHaveBeenCalledTimes(1);
		expect(dependencies.fail).toHaveBeenCalledWith(deletedGenerating, {
			completedAt: NOW,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			expectedStatus: "generating",
			reason: "project_deleted",
		});
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("preserves the settled charge when deletion wins the R2 recovery CAS", async () => {
		const generating = makeAttempt({
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
			triggerRunId: "run_original",
		});
		const deletedGenerating = makeAttempt({
			projectDeletedAt: NOW,
			startedAt: generating.startedAt,
			status: "generating",
			triggerRunId: "run_original",
		});
		const dependencies = makeDependencies(generating, {
			recovered: {
				mediaType: "video/mp4",
				url: "https://assets.test/recovered.mp4",
			},
		});
		vi.mocked(dependencies.loadAttempt)
			.mockResolvedValueOnce(generating)
			.mockResolvedValueOnce(deletedGenerating);
		vi.mocked(dependencies.markSucceeded).mockResolvedValueOnce(false);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_recovery",
			}),
		).resolves.toEqual({
			reason: "project_deleted",
			status: "failed",
		});
		expect(dependencies.generate).not.toHaveBeenCalled();
		expect(dependencies.fail).toHaveBeenCalledWith(deletedGenerating, {
			completedAt: NOW,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			expectedStatus: "generating",
			reason: "project_deleted",
		});
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("never invokes the provider for a duplicate generating delivery", async () => {
		const attempt = makeAttempt({
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
			triggerRunId: "run_original",
		});
		const dependencies = makeDependencies(attempt, {
			recovered: {
				mediaType: "video/webm",
				url: "https://assets.test/video.webm",
			},
		});

		const result = await runImageAnimation(payload(), {
			dependencies,
			runId: "run_duplicate",
		});

		expect(result).toMatchObject({
			mediaType: "video/webm",
			recovered: true,
			status: "succeeded",
		});
		expect(dependencies.claimQueued).not.toHaveBeenCalled();
		expect(dependencies.reserve).not.toHaveBeenCalled();
		expect(dependencies.settleExisting).toHaveBeenCalledWith(
			USER_ID,
			ATTEMPT_ID,
		);
		expect(dependencies.generate).not.toHaveBeenCalled();
	});

	it("fails closed when enforced stored-video recovery has no metering event", async () => {
		const attempt = makeAttempt({
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
		});
		const dependencies = makeDependencies(attempt, {
			recovered: {
				mediaType: "video/mp4",
				url: "https://assets.test/video.mp4",
			},
		});
		vi.mocked(dependencies.settleExisting).mockResolvedValueOnce(false);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_missing_metering",
			}),
		).rejects.toThrow("no enforced metering event");
		expect(dependencies.markSucceeded).not.toHaveBeenCalled();
		expect(dependencies.generate).not.toHaveBeenCalled();
	});

	it("treats a lost claim race as recovery-only", async () => {
		const queued = makeAttempt();
		const raced = makeAttempt({
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
			triggerRunId: "run_winner",
		});
		const dependencies = makeDependencies(queued, {
			recovered: {
				mediaType: "video/mp4",
				url: "https://assets.test/recovered.mp4",
			},
		});
		vi.mocked(dependencies.claimQueued).mockResolvedValueOnce(null);
		vi.mocked(dependencies.loadAttempt)
			.mockResolvedValueOnce(queued)
			.mockResolvedValueOnce(raced);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_loser",
			}),
		).resolves.toMatchObject({ recovered: true, status: "succeeded" });
		expect(dependencies.reserve).not.toHaveBeenCalled();
		expect(dependencies.settleExisting).toHaveBeenCalledWith(
			USER_ID,
			ATTEMPT_ID,
		);
		expect(dependencies.generate).not.toHaveBeenCalled();
	});

	it("propagates a transient claim write failure without invoking the provider", async () => {
		const attempt = makeAttempt();
		const dependencies = makeDependencies(attempt);
		vi.mocked(dependencies.claimQueued).mockRejectedValueOnce(
			new Error("database unavailable"),
		);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_123",
			}),
		).rejects.toThrow("database unavailable");
		expect(dependencies.reserve).not.toHaveBeenCalled();
		expect(dependencies.generate).not.toHaveBeenCalled();
	});

	it("keeps a non-stale generating attempt retryable without regenerating", async () => {
		const attempt = makeAttempt({
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
		});
		const dependencies = makeDependencies(attempt, { recovered: null });

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_retry",
			}),
		).rejects.toBeInstanceOf(ImageAnimationSettlementPendingError);
		expect(dependencies.generate).not.toHaveBeenCalled();
		expect(dependencies.fail).not.toHaveBeenCalled();
	});

	it("fails and refunds a stale generating attempt without regenerating", async () => {
		const attempt = makeAttempt({
			startedAt: new Date(
				NOW.getTime() - IMAGE_ANIMATION_STALE_GENERATING_MS - 1,
			),
			status: "generating",
		});
		const dependencies = makeDependencies(attempt, { recovered: null });

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_retry",
			}),
		).resolves.toEqual({
			reason: "stale_generation",
			status: "failed",
		});
		expect(dependencies.generate).not.toHaveBeenCalled();
		expect(dependencies.fail).toHaveBeenCalledWith(attempt, {
			completedAt: NOW,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			expectedStatus: "generating",
			reason: "stale_generation",
		});
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ATTEMPT_ID);
	});

	it("settles a failed reservation and never calls the provider", async () => {
		const attempt = makeAttempt();
		const dependencies = makeDependencies(attempt);
		vi.mocked(dependencies.reserve).mockRejectedValueOnce(
			new Error("transient ledger response"),
		);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_123",
			}),
		).resolves.toEqual({
			reason: "reservation_failed",
			status: "failed",
		});
		expect(dependencies.generate).not.toHaveBeenCalled();
		expect(dependencies.fail).toHaveBeenCalled();
		expect(dependencies.refund).toHaveBeenCalled();
	});

	it("persists a safe failure and refunds when provider generation fails", async () => {
		const attempt = makeAttempt();
		const dependencies = makeDependencies(attempt);
		vi.mocked(dependencies.generate).mockResolvedValueOnce({
			message: "raw provider secret",
			status: "failed",
		});

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_123",
			}),
		).resolves.toEqual({
			reason: "generation_failed",
			status: "failed",
		});
		expect(dependencies.fail).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ error: USER_SAFE_IMAGE_ANIMATION_ERROR }),
		);
		expect(dependencies.fail).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ error: "raw provider secret" }),
		);
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ATTEMPT_ID);
	});

	it("charges a provider-completed video when storage fails after capture", async () => {
		const dependencies = makeDependencies(makeAttempt());
		vi.mocked(dependencies.generate).mockImplementationOnce(
			async (_attempt, _signal, onProviderGeneration) => {
				const generation = {
					model: "klingai/kling-v2.1",
					providerMetadata: {
						gateway: { generationId: "generation-storage-failure" },
					},
					usage: { inputTokens: 1 },
				};
				await onProviderGeneration?.(generation);
				return {
					...generation,
					message: "R2 unavailable",
					providerUnits: 1,
					status: "failed" as const,
				};
			},
		);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_storage_failure",
			}),
		).resolves.toEqual({ reason: "generation_failed", status: "failed" });
		expect(dependencies.capture).toHaveBeenCalledWith(
			RESERVATION,
			expect.objectContaining({
				stepUsage: expect.objectContaining({
					metering: { fixedUnits: 1 },
				}),
			}),
		);
		expect(dependencies.settle).toHaveBeenCalledWith(RESERVATION, 1);
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("recovers an upload after a completion write failure without a second provider call", async () => {
		let state = makeAttempt();
		let storedVideo: { mediaType: string; url: string } | null = null;
		const dependencies = makeDependencies(state);

		vi.mocked(dependencies.loadAttempt).mockImplementation(async () => state);
		vi.mocked(dependencies.claimQueued).mockImplementation(
			async (_attempt, input) => {
				state = makeAttempt({
					startedAt: input.startedAt,
					status: "generating",
					triggerRunId: input.runId,
				});
				return state;
			},
		);
		vi.mocked(dependencies.generate).mockImplementation(async () => {
			storedVideo = {
				mediaType: "video/mp4",
				url: "https://assets.test/video.mp4",
			};
			return {
				...storedVideo,
				model: "klingai/kling-v2.1",
				providerMetadata: { gateway: { generationId: "generation_1" } },
				status: "generated",
			};
		});
		vi.mocked(dependencies.recoverStoredVideo).mockImplementation(
			async () => storedVideo,
		);
		vi.mocked(dependencies.reserve)
			.mockResolvedValueOnce(RESERVATION)
			.mockResolvedValueOnce({ ...RESERVATION, replay: "settled" });
		vi.mocked(dependencies.markSucceeded)
			.mockRejectedValueOnce(new Error("database connection lost"))
			.mockImplementationOnce(async (_attempt, video) => {
				state = makeAttempt({
					completedAt: NOW,
					startedAt: state.startedAt,
					status: "succeeded",
					triggerRunId: state.triggerRunId,
					videoMediaType: video.mediaType,
					videoUrl: video.url,
				});
				return true;
			});

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_123",
			}),
		).rejects.toThrow("database connection lost");

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_123",
			}),
		).resolves.toMatchObject({ recovered: true, status: "succeeded" });
		expect(dependencies.generate).toHaveBeenCalledTimes(1);
		expect(
			vi.mocked(dependencies.settle).mock.invocationCallOrder[0],
		).toBeLessThan(
			vi.mocked(dependencies.markSucceeded).mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
	});

	it("propagates transient R2 and refund errors for Trigger retry", async () => {
		const generating = makeAttempt({
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
		});
		const recoveryDependencies = makeDependencies(generating);
		vi.mocked(recoveryDependencies.recoverStoredVideo).mockRejectedValueOnce(
			new Error("R2 unavailable"),
		);

		await expect(
			runImageAnimation(payload(), {
				dependencies: recoveryDependencies,
				runId: "run_retry",
			}),
		).rejects.toThrow("R2 unavailable");
		expect(recoveryDependencies.generate).not.toHaveBeenCalled();

		const failed = makeAttempt({
			completedAt: NOW,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
			status: "failed",
		});
		const refundDependencies = makeDependencies(failed);
		vi.mocked(refundDependencies.refund).mockRejectedValueOnce(
			new Error("ledger unavailable"),
		);

		await expect(
			runImageAnimation(payload(), {
				dependencies: refundDependencies,
				runId: "run_retry",
			}),
		).rejects.toThrow("ledger unavailable");
		expect(refundDependencies.generate).not.toHaveBeenCalled();
	});

	it("uses payload ids only to reject/refund an ownership mismatch", async () => {
		const attempt = makeAttempt({ userId: "different_user" });
		const dependencies = makeDependencies(attempt);

		await expect(
			runImageAnimation(payload(), {
				dependencies,
				runId: "run_forged",
			}),
		).resolves.toEqual({
			reason: "ownership_mismatch",
			status: "failed",
		});
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ATTEMPT_ID);
		expect(dependencies.claimQueued).not.toHaveBeenCalled();
		expect(dependencies.generate).not.toHaveBeenCalled();
	});
});

function payload() {
	return {
		attemptId: ATTEMPT_ID,
		billingMode: "enforce" as const,
		projectId: PROJECT_ID,
		userId: USER_ID,
	};
}

function makeAttempt(
	overrides: Partial<ImageAnimationAttempt> = {},
): ImageAnimationAttempt {
	return {
		aspect: "16:9",
		completedAt: null,
		error: null,
		id: ATTEMPT_ID,
		motion: "balanced",
		projectDeletedAt: null,
		projectId: PROJECT_ID,
		prompt: "A gentle camera move",
		sourceImageUrl: "https://assets.test/source.webp",
		startedAt: null,
		status: "queued",
		triggerRunId: null,
		userId: USER_ID,
		videoMediaType: null,
		videoUrl: null,
		...overrides,
	};
}

function makeDependencies(
	attempt: ImageAnimationAttempt,
	options: {
		recovered?: { mediaType: string; url: string } | null;
	} = {},
): ImageAnimationRunnerDependencies {
	const claimed = makeAttempt({
		...attempt,
		startedAt: NOW,
		status: "generating",
		triggerRunId: "run_123",
	});

	return {
		capture: vi.fn(async () => undefined),
		claimQueued: vi.fn(async () => claimed),
		fail: vi.fn(async () => true),
		generate: vi.fn(async () => ({
			mediaType: "video/mp4",
			model: "klingai/kling-v2.1",
			providerMetadata: { gateway: { generationId: "generation_1" } },
			status: "generated" as const,
			url: "https://assets.test/video.mp4",
		})),
		loadAttempt: vi.fn(async () => attempt),
		markSucceeded: vi.fn(async () => true),
		now: vi.fn(() => NOW),
		recoverStoredVideo: vi.fn(async () => options.recovered ?? null),
		refund: vi.fn(async () => undefined),
		reserve: vi.fn(async () => RESERVATION),
		settle: vi.fn(async () => undefined),
		settleExisting: vi.fn(async () => true),
	};
}
