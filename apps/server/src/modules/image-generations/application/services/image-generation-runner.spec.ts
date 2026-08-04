import { describe, expect, it, vi } from "vitest";

import {
	type GeneratedImageResult,
	type ImageGenerationAttemptState,
	type ImageGenerationRunnerDependencies,
	ImageGenerationSettlementPendingError,
	parseImageGenerationPayload,
	runImageGeneration,
} from "./image-generation-runner";

const ATTEMPT_ID = "11111111-1111-1111-8111-911111111111";
const PROJECT_ID = "22222222-2222-4222-8222-922222222222";
const USER_ID = "user_1";
const SUBJECT = { actorUserId: USER_ID };
const PARENT_EVENT_ID = "44444444-4444-4444-8444-944444444444";

const PAYLOAD = {
	attemptId: ATTEMPT_ID,
	billingMode: "enforce" as const,
	projectId: PROJECT_ID,
	userId: USER_ID,
};

const RESERVATION = {
	credits: 10,
	eventId: "33333333-3333-4333-8333-933333333333",
	operation: "image" as const,
	referenceId: ATTEMPT_ID,
	replay: "none" as const,
	units: 2,
};

function makeAttempt(
	overrides: Partial<ImageGenerationAttemptState> = {},
): ImageGenerationAttemptState {
	return {
		aspect: "1:1",
		completedAt: null,
		count: 2,
		error: null,
		id: ATTEMPT_ID,
		images: null,
		organizationId: null,
		projectDeletedAt: null,
		projectId: PROJECT_ID,
		prompt: "a product on a bench",
		sourceImageUrls: [],
		spec: null,
		startedAt: null,
		status: "queued",
		title: "Product shots",
		triggerRunId: null,
		userId: USER_ID,
		...overrides,
	};
}

function makeImages(count: number): GeneratedImageResult[] {
	return Array.from({ length: count }, (_, i) => ({
		mediaType: "image/png",
		url: `https://assets.example.com/images/p/a/img-${i + 1}.png`,
	}));
}

function makeDependencies(
	overrides: Partial<ImageGenerationRunnerDependencies> = {},
): ImageGenerationRunnerDependencies {
	const queued = makeAttempt();
	const generating = makeAttempt({
		startedAt: new Date("2026-01-01T00:00:00Z"),
		status: "generating",
	});

	return {
		capture: vi.fn().mockResolvedValue(undefined),
		claimQueued: vi.fn().mockResolvedValue(generating),
		fail: vi.fn().mockResolvedValue(true),
		generateOne: vi.fn().mockImplementation((_attempt, _subject, index: number) =>
			Promise.resolve({
				mediaType: "image/png",
				model: "openai/gpt-image-2",
				providerMetadata: {
					gateway: { generationId: `generation_${index}` },
				},
				status: "generated" as const,
				usage: { inputTokens: 1 },
				url: `https://assets.example.com/images/p/a/img-${index}.png`,
			}),
		),
		loadAttempt: vi.fn().mockResolvedValue(queued),
		markSucceeded: vi.fn().mockResolvedValue(true),
		now: () => new Date("2026-01-01T00:05:00Z"),
		recoverStoredImages: vi.fn().mockResolvedValue(null),
		refund: vi.fn().mockResolvedValue(undefined),
		reserve: vi.fn().mockResolvedValue(RESERVATION),
		settle: vi.fn().mockResolvedValue(undefined),
		settleExisting: vi.fn().mockResolvedValue(true),
		settlePlacement: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("parseImageGenerationPayload", () => {
	it("accepts the exact payload shape", () => {
		expect(parseImageGenerationPayload(PAYLOAD)).toEqual({
			...PAYLOAD,
			organizationId: null,
		});
		expect(
			parseImageGenerationPayload({
				...PAYLOAD,
				parentEventId: PARENT_EVENT_ID,
			}),
		).toEqual({
			...PAYLOAD,
			organizationId: null,
			parentEventId: PARENT_EVENT_ID,
		});
	});

	it("accepts a pre-deploy payload without an admission snapshot", () => {
		const { billingMode: _billingMode, ...legacyPayload } = PAYLOAD;

		expect(parseImageGenerationPayload(legacyPayload)).toEqual({
			...legacyPayload,
			organizationId: null,
		});
	});

	it("rejects extra keys and bad ids", () => {
		expect(() =>
			parseImageGenerationPayload({ ...PAYLOAD, extra: 1 }),
		).toThrow();
		expect(() =>
			parseImageGenerationPayload({ ...PAYLOAD, attemptId: "nope" }),
		).toThrow();
	});
});

describe("runImageGeneration", () => {
	it("claims, reserves, generates every image sequentially, and persists", async () => {
		const dependencies = makeDependencies();

		const result = await runImageGeneration(
			{ ...PAYLOAD, parentEventId: PARENT_EVENT_ID },
			{
				dependencies,
				runId: "run_1",
			},
		);

		expect(dependencies.reserve).toHaveBeenCalledWith(
			SUBJECT,
			ATTEMPT_ID,
			2,
			PARENT_EVENT_ID,
			"enforce",
		);
		expect(dependencies.generateOne).toHaveBeenCalledTimes(2);
		expect(dependencies.capture).toHaveBeenCalledTimes(2);
		expect(dependencies.settle).toHaveBeenCalledWith(RESERVATION);
		expect(dependencies.generateOne).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ id: ATTEMPT_ID }),
			SUBJECT,
			1,
			undefined,
			expect.any(Function),
		);
		expect(dependencies.generateOne).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ id: ATTEMPT_ID }),
			SUBJECT,
			2,
			undefined,
			expect.any(Function),
		);
		expect(dependencies.markSucceeded).toHaveBeenCalledWith(
			expect.objectContaining({ id: ATTEMPT_ID }),
			makeImages(2),
			expect.any(Date),
		);
		expect(
			vi.mocked(dependencies.settle).mock.invocationCallOrder[0],
		).toBeLessThan(
			vi.mocked(dependencies.markSucceeded).mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
		expect(dependencies.settlePlacement).toHaveBeenCalledWith(
			expect.objectContaining({ id: ATTEMPT_ID }),
			makeImages(2),
		);
		expect(result).toEqual({
			images: makeImages(2),
			recovered: false,
			status: "succeeded",
		});
	});

	it("meters an org attempt with the acting member, not the project creator", async () => {
		const organizationId = "org_1";
		const actingMemberId = "user_member_2";
		const queued = makeAttempt({ organizationId });
		const generating = makeAttempt({
			organizationId,
			startedAt: new Date("2026-01-01T00:00:00Z"),
			status: "generating",
		});
		const orgSubject = { actorUserId: actingMemberId, organizationId };
		const dependencies = makeDependencies({
			claimQueued: vi.fn().mockResolvedValue(generating),
			loadAttempt: vi.fn().mockResolvedValue(queued),
		});

		const result = await runImageGeneration(
			// The acting member differs from attempt.userId (the creator): the
			// tool-side hold was reserved by them, so the replay must match them.
			{ ...PAYLOAD, organizationId, userId: actingMemberId },
			{ dependencies, runId: "run_org_actor" },
		);

		expect(dependencies.reserve).toHaveBeenCalledWith(
			orgSubject,
			ATTEMPT_ID,
			2,
			undefined,
			"enforce",
		);
		expect(dependencies.generateOne).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ id: ATTEMPT_ID, userId: USER_ID }),
			orgSubject,
			1,
			undefined,
			expect.any(Function),
		);
		expect(result).toEqual({
			images: makeImages(2),
			recovered: false,
			status: "succeeded",
		});
	});

	it("refunds an org attempt to the pool under the acting member", async () => {
		const organizationId = "org_1";
		const actingMemberId = "user_member_2";
		const generating = makeAttempt({
			organizationId,
			startedAt: new Date("2026-01-01T00:00:00Z"),
			status: "generating",
		});
		const dependencies = makeDependencies({
			claimQueued: vi.fn().mockResolvedValue(generating),
			generateOne: vi
				.fn()
				.mockResolvedValueOnce({ message: "quota", status: "failed" }),
			loadAttempt: vi.fn().mockResolvedValue(makeAttempt({ organizationId })),
		});

		await expect(
			runImageGeneration(
				{ ...PAYLOAD, organizationId, userId: actingMemberId },
				{ dependencies, runId: "run_org_refund" },
			),
		).resolves.toEqual({ reason: "generation_failed", status: "failed" });
		expect(dependencies.refund).toHaveBeenCalledWith(
			{ actorUserId: actingMemberId, organizationId },
			ATTEMPT_ID,
		);
	});

	it("publishes a stored partial prefix after reconcile_failed without repricing", async () => {
		const generating = makeAttempt({
			count: 4,
			startedAt: new Date("2026-01-01T00:04:00Z"),
			status: "generating",
		});
		const recovered = makeImages(1);
		const dependencies = makeDependencies({
			loadAttempt: vi.fn().mockResolvedValue(generating),
			recoverStoredImages: vi.fn().mockResolvedValue(recovered),
		});

		await expect(
			runImageGeneration(PAYLOAD, {
				dependencies,
				runId: "run_partial_recovery",
			}),
		).resolves.toEqual({
			images: recovered,
			recovered: true,
			status: "succeeded",
		});
		expect(dependencies.generateOne).not.toHaveBeenCalled();
		expect(dependencies.settleExisting).toHaveBeenCalledWith(
			SUBJECT,
			ATTEMPT_ID,
			1,
		);
		expect(dependencies.reserve).not.toHaveBeenCalled();
		expect(dependencies.settle).not.toHaveBeenCalled();
		expect(dependencies.markSucceeded).toHaveBeenCalledOnce();
	});

	it("repairs terminal billing when storage appears during reservation replay", async () => {
		const generating = makeAttempt({
			count: 4,
			startedAt: new Date("2026-01-01T00:04:00Z"),
			status: "generating",
		});
		const recovered = makeImages(1);
		const dependencies = makeDependencies({
			loadAttempt: vi.fn().mockResolvedValue(generating),
			recoverStoredImages: vi
				.fn()
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(recovered),
			reserve: vi.fn().mockResolvedValue({
				...RESERVATION,
				credits: 20,
				replay: "reconcile_failed",
				units: 4,
			}),
		});

		await expect(
			runImageGeneration(PAYLOAD, {
				dependencies,
				runId: "run_terminal_storage_race",
			}),
		).resolves.toEqual({
			images: recovered,
			recovered: true,
			status: "succeeded",
		});
		expect(dependencies.recoverStoredImages).toHaveBeenCalledTimes(2);
		expect(dependencies.settleExisting).toHaveBeenCalledWith(
			SUBJECT,
			ATTEMPT_ID,
			1,
		);
		expect(dependencies.settle).not.toHaveBeenCalled();
		expect(dependencies.generateOne).not.toHaveBeenCalled();
		expect(dependencies.markSucceeded).toHaveBeenCalledOnce();
	});

	it("does not refund after settlement when deletion wins the success CAS", async () => {
		const queued = makeAttempt();
		const deletedGenerating = makeAttempt({
			projectDeletedAt: new Date("2026-01-01T00:05:00Z"),
			startedAt: new Date("2026-01-01T00:00:00Z"),
			status: "generating",
		});
		const dependencies = makeDependencies();
		vi.mocked(dependencies.loadAttempt)
			.mockResolvedValueOnce(queued)
			.mockResolvedValueOnce(deletedGenerating);
		vi.mocked(dependencies.markSucceeded).mockResolvedValueOnce(false);

		await expect(
			runImageGeneration(PAYLOAD, {
				dependencies,
				runId: "run_deleted_after_settle",
			}),
		).resolves.toEqual({ reason: "project_deleted", status: "failed" });
		expect(dependencies.settle).toHaveBeenCalledWith(RESERVATION);
		expect(dependencies.fail).toHaveBeenCalledOnce();
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("does not settle twice when another success wins the persistence CAS", async () => {
		const queued = makeAttempt();
		const succeeded = makeAttempt({
			completedAt: new Date("2026-01-01T00:05:00Z"),
			images: makeImages(2),
			startedAt: new Date("2026-01-01T00:00:00Z"),
			status: "succeeded",
		});
		const dependencies = makeDependencies();
		vi.mocked(dependencies.loadAttempt)
			.mockResolvedValueOnce(queued)
			.mockResolvedValueOnce(succeeded);
		vi.mocked(dependencies.markSucceeded).mockResolvedValueOnce(false);

		await expect(
			runImageGeneration(PAYLOAD, {
				dependencies,
				runId: "run_success_cas_loss",
			}),
		).resolves.toEqual({
			images: makeImages(2),
			recovered: true,
			status: "succeeded",
		});
		expect(dependencies.settle).toHaveBeenCalledOnce();
		expect(dependencies.settle).toHaveBeenCalledWith(RESERVATION);
		expect(dependencies.settlePlacement).toHaveBeenCalledWith(
			succeeded,
			makeImages(2),
		);
	});

	it("fails once and refunds when the provider fails before any image exists", async () => {
		const dependencies = makeDependencies({
			generateOne: vi
				.fn()
				.mockResolvedValueOnce({ message: "quota", status: "failed" }),
		});

		const result = await runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_1",
		});

		expect(result).toEqual({ reason: "generation_failed", status: "failed" });
		expect(dependencies.fail).toHaveBeenCalledTimes(1);
		expect(dependencies.refund).toHaveBeenCalledTimes(1);
		expect(dependencies.markSucceeded).not.toHaveBeenCalled();
		expect(dependencies.settlePlacement).not.toHaveBeenCalled();
	});

	it("delivers and charges one uploaded image when request four fails later", async () => {
		const queued = makeAttempt({ count: 4 });
		const generating = makeAttempt({
			count: 4,
			startedAt: new Date("2026-01-01T00:00:00Z"),
			status: "generating",
		});
		const reservation = { ...RESERVATION, credits: 20, units: 4 };
		const dependencies = makeDependencies({
			claimQueued: vi.fn().mockResolvedValue(generating),
			generateOne: vi
				.fn()
				.mockResolvedValueOnce({
					mediaType: "image/png",
					model: "openai/gpt-image-2",
					providerMetadata: {
						gateway: { generationId: "generation_1" },
					},
					status: "generated",
					usage: { inputTokens: 1 },
					url: "https://assets.example.com/images/p/a/img-1.png",
				})
				.mockResolvedValueOnce({ message: "quota", status: "failed" }),
			loadAttempt: vi.fn().mockResolvedValue(queued),
			reserve: vi.fn().mockResolvedValue(reservation),
		});

		await expect(
			runImageGeneration(PAYLOAD, { dependencies, runId: "run_partial" }),
		).resolves.toEqual({
			images: [
				{
					mediaType: "image/png",
					url: "https://assets.example.com/images/p/a/img-1.png",
				},
			],
			recovered: false,
			status: "succeeded",
		});
		expect(dependencies.capture).toHaveBeenCalledOnce();
		expect(dependencies.settle).toHaveBeenCalledWith(reservation, 1);
		expect(dependencies.markSucceeded).toHaveBeenCalledWith(
			generating,
			[
				{
					mediaType: "image/png",
					url: "https://assets.example.com/images/p/a/img-1.png",
				},
			],
			expect.any(Date),
		);
		expect(dependencies.fail).not.toHaveBeenCalled();
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("never exposes an uploaded image whose generation ref capture failed", async () => {
		const dependencies = makeDependencies();
		vi.mocked(dependencies.capture)
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("generation-ref database unavailable"));

		await expect(
			runImageGeneration(PAYLOAD, { dependencies, runId: "run_capture" }),
		).resolves.toMatchObject({
			images: [
				expect.objectContaining({ url: expect.stringContaining("img-1") }),
			],
			status: "succeeded",
		});
		expect(dependencies.generateOne).toHaveBeenCalledTimes(2);
		expect(dependencies.capture).toHaveBeenCalledTimes(2);
		expect(dependencies.settle).toHaveBeenCalledWith(RESERVATION, 1);
		expect(dependencies.fail).not.toHaveBeenCalled();
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("settles zero when a gateway response produces no image", async () => {
		const dependencies = makeDependencies({
			generateOne: vi.fn().mockResolvedValueOnce({
				message: "the image model returned no image",
				model: "openai/gpt-image-2",
				providerMetadata: { gateway: { generationId: "generation_empty" } },
				providerUnits: 0,
				status: "failed",
			}),
		});

		await expect(
			runImageGeneration(PAYLOAD, { dependencies, runId: "run_empty" }),
		).resolves.toEqual({ reason: "generation_failed", status: "failed" });
		expect(dependencies.capture).toHaveBeenCalledWith(
			RESERVATION,
			expect.objectContaining({
				stepUsage: {
					metering: { fixedUnits: 0 },
					providerUsage: null,
				},
			}),
		);
		expect(dependencies.settle).toHaveBeenCalledWith(RESERVATION, 0);
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("charges a provider-completed image when storage fails after capture", async () => {
		const dependencies = makeDependencies({
			generateOne: vi.fn(
				async (_attempt, _index, _signal, onProviderGeneration) => {
					const generation = {
						model: "openai/gpt-image-2",
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
			),
		});

		await expect(
			runImageGeneration(PAYLOAD, {
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

	it("never calls the provider when the reservation fails", async () => {
		const dependencies = makeDependencies({
			reserve: vi.fn().mockRejectedValue(new Error("no credits")),
		});

		const result = await runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_1",
		});

		expect(result).toEqual({ reason: "reservation_failed", status: "failed" });
		expect(dependencies.generateOne).not.toHaveBeenCalled();
		expect(dependencies.settlePlacement).not.toHaveBeenCalled();
		expect(dependencies.refund).toHaveBeenCalled();
	});

	it("fails without refund or provider replay after reconcile_failed", async () => {
		const dependencies = makeDependencies({
			reserve: vi.fn().mockResolvedValue({
				...RESERVATION,
				replay: "reconcile_failed",
			}),
		});

		await expect(
			runImageGeneration(PAYLOAD, { dependencies, runId: "run_replay" }),
		).resolves.toEqual({ reason: "generation_failed", status: "failed" });
		expect(dependencies.generateOne).not.toHaveBeenCalled();
		expect(dependencies.markSucceeded).not.toHaveBeenCalled();
		expect(dependencies.refund).not.toHaveBeenCalled();
		expect(dependencies.fail).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ reason: "terminal_billing" }),
		);
	});

	it("recovers stored images for a generating row without re-invoking the provider", async () => {
		const generating = makeAttempt({
			startedAt: new Date("2026-01-01T00:04:00Z"),
			status: "generating",
		});
		const dependencies = makeDependencies({
			loadAttempt: vi.fn().mockResolvedValue(generating),
			recoverStoredImages: vi.fn().mockResolvedValue(makeImages(2)),
		});

		const result = await runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_1",
		});

		expect(dependencies.generateOne).not.toHaveBeenCalled();
		expect(dependencies.settleExisting).toHaveBeenCalledWith(
			SUBJECT,
			ATTEMPT_ID,
			2,
		);
		expect(
			vi.mocked(dependencies.settleExisting).mock.invocationCallOrder[0],
		).toBeLessThan(
			vi.mocked(dependencies.markSucceeded).mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
		expect(result).toEqual({
			images: makeImages(2),
			recovered: true,
			status: "succeeded",
		});
		expect(dependencies.settlePlacement).toHaveBeenCalledWith(
			generating,
			makeImages(2),
		);
	});

	it("fails closed when enforced stored-image recovery has no metering event", async () => {
		const generating = makeAttempt({
			startedAt: new Date("2026-01-01T00:04:00Z"),
			status: "generating",
		});
		const dependencies = makeDependencies({
			loadAttempt: vi.fn().mockResolvedValue(generating),
			recoverStoredImages: vi.fn().mockResolvedValue(makeImages(1)),
			settleExisting: vi.fn().mockResolvedValue(false),
		});

		await expect(
			runImageGeneration(PAYLOAD, {
				dependencies,
				runId: "run_missing_metering",
			}),
		).rejects.toThrow("no enforced metering event");
		expect(dependencies.markSucceeded).not.toHaveBeenCalled();
		expect(dependencies.generateOne).not.toHaveBeenCalled();
	});

	it("throws settlement-pending for a fresh generating row with no stored output", async () => {
		const generating = makeAttempt({
			startedAt: new Date("2026-01-01T00:04:30Z"),
			status: "generating",
		});
		const dependencies = makeDependencies({
			loadAttempt: vi.fn().mockResolvedValue(generating),
		});

		await expect(
			runImageGeneration(PAYLOAD, { dependencies, runId: "run_1" }),
		).rejects.toBeInstanceOf(ImageGenerationSettlementPendingError);
	});

	it("re-reads authoritative state after losing the claim race", async () => {
		const succeeded = makeAttempt({
			completedAt: new Date("2026-01-01T00:04:00Z"),
			images: makeImages(2),
			startedAt: new Date("2026-01-01T00:03:00Z"),
			status: "succeeded",
		});
		const loadAttempt = vi
			.fn()
			.mockResolvedValueOnce(makeAttempt())
			.mockResolvedValueOnce(succeeded);
		const dependencies = makeDependencies({
			claimQueued: vi.fn().mockResolvedValue(null),
			loadAttempt,
		});

		const result = await runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_1",
		});

		expect(dependencies.generateOne).not.toHaveBeenCalled();
		expect(result).toEqual({
			images: makeImages(2),
			recovered: false,
			status: "succeeded",
		});
		expect(dependencies.settlePlacement).toHaveBeenCalledWith(
			succeeded,
			makeImages(2),
		);
	});

	it("resumes placement without repricing a partially succeeded attempt", async () => {
		const succeeded = makeAttempt({
			completedAt: new Date("2026-01-01T00:04:00Z"),
			count: 4,
			images: makeImages(1),
			startedAt: new Date("2026-01-01T00:03:00Z"),
			status: "succeeded",
		});
		const reservation = { ...RESERVATION, credits: 20, units: 4 };
		const dependencies = makeDependencies({
			loadAttempt: vi.fn().mockResolvedValue(succeeded),
			reserve: vi.fn().mockResolvedValue(reservation),
		});

		await runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_2",
		});

		expect(dependencies.claimQueued).not.toHaveBeenCalled();
		expect(dependencies.generateOne).not.toHaveBeenCalled();
		expect(dependencies.markSucceeded).not.toHaveBeenCalled();
		expect(dependencies.reserve).toHaveBeenCalledWith(
			SUBJECT,
			ATTEMPT_ID,
			4,
			undefined,
			"enforce",
		);
		expect(dependencies.settleExisting).toHaveBeenCalledWith(
			SUBJECT,
			ATTEMPT_ID,
			1,
		);
		expect(dependencies.settle).not.toHaveBeenCalled();
		expect(dependencies.settlePlacement).toHaveBeenCalledOnce();
		expect(dependencies.settlePlacement).toHaveBeenCalledWith(
			succeeded,
			makeImages(1),
		);
	});

	it("propagates placement failure without failing or refunding durable output", async () => {
		const placementError = new Error("placement database unavailable");
		const succeeded = makeAttempt({
			completedAt: new Date("2026-01-01T00:04:00Z"),
			images: makeImages(2),
			startedAt: new Date("2026-01-01T00:03:00Z"),
			status: "succeeded",
		});
		const dependencies = makeDependencies({
			loadAttempt: vi.fn().mockResolvedValue(succeeded),
			settlePlacement: vi.fn().mockRejectedValue(placementError),
		});

		await expect(
			runImageGeneration(PAYLOAD, {
				dependencies,
				runId: "run_2",
			}),
		).rejects.toBe(placementError);

		expect(dependencies.settlePlacement).toHaveBeenCalledWith(
			succeeded,
			makeImages(2),
		);
		expect(dependencies.fail).not.toHaveBeenCalled();
		expect(dependencies.refund).not.toHaveBeenCalled();
		expect(dependencies.markSucceeded).not.toHaveBeenCalled();
	});

	it("refunds and fails on ownership mismatch", async () => {
		const dependencies = makeDependencies({
			loadAttempt: vi
				.fn()
				.mockResolvedValue(makeAttempt({ projectId: "other" })),
		});

		const result = await runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_1",
		});

		expect(result).toEqual({ reason: "ownership_mismatch", status: "failed" });
		expect(dependencies.refund).toHaveBeenCalledWith(SUBJECT, ATTEMPT_ID);
	});
});
