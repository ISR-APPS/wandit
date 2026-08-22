import { describe, expect, it, vi } from "vitest";

import {
	type GeneratedImageResult,
	type ImageGenerationAttemptState,
	type ImageGenerationProviderResult,
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

type Deferred<Value> = {
	promise: Promise<Value>;
	resolve: (value: Value) => void;
};

function deferred<Value>(): Deferred<Value> {
	let resolve!: Deferred<Value>["resolve"];
	const promise = new Promise<Value>((resolvePromise) => {
		resolve = resolvePromise;
	});

	return { promise, resolve };
}

function generated(index: number) {
	return {
		mediaType: "image/png",
		model: "openai/gpt-image-2",
		providerMetadata: { gateway: { generationId: `generation_${index}` } },
		status: "generated" as const,
		usage: { inputTokens: 1 },
		url: `https://assets.example.com/images/p/a/img-${index}.png`,
	};
}

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
		index: i + 1,
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
		generateOne: vi
			.fn()
			.mockImplementation((_attempt, _subject, index: number) =>
				Promise.resolve(generated(index)),
			),
		loadAttempt: vi.fn().mockResolvedValue(queued),
		markSucceeded: vi.fn().mockResolvedValue(true),
		now: () => new Date("2026-01-01T00:05:00Z"),
		persistProgress: vi.fn().mockResolvedValue(true),
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
	it("claims, reserves, generates every image in parallel, and persists", async () => {
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
		expect(dependencies.persistProgress).toHaveBeenCalledTimes(2);
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

	it("caps provider concurrency at two", async () => {
		const queued = makeAttempt({ count: 4 });
		const generating = makeAttempt({
			count: 4,
			startedAt: new Date("2026-01-01T00:00:00Z"),
			status: "generating",
		});
		const gates = new Map(
			[1, 2, 3, 4].map((index) => [
				index,
				deferred<ImageGenerationProviderResult>(),
			]),
		);
		const started: number[] = [];
		let active = 0;
		let maxActive = 0;
		const dependencies = makeDependencies({
			claimQueued: vi.fn().mockResolvedValue(generating),
			generateOne: vi.fn(async (_attempt, _subject, index) => {
				started.push(index);
				active += 1;
				maxActive = Math.max(maxActive, active);

				try {
					return await (
						gates.get(index) as Deferred<ImageGenerationProviderResult>
					).promise;
				} finally {
					active -= 1;
				}
			}),
			loadAttempt: vi.fn().mockResolvedValue(queued),
			reserve: vi.fn().mockResolvedValue({
				...RESERVATION,
				credits: 20,
				units: 4,
			}),
		});
		const run = runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_parallel_cap",
		});

		await vi.waitFor(() => expect(started).toEqual([1, 2]));
		gates.get(2)?.resolve(generated(2));
		await vi.waitFor(() => expect(started).toEqual([1, 2, 3]));
		gates.get(1)?.resolve(generated(1));
		await vi.waitFor(() => expect(started).toEqual([1, 2, 3, 4]));
		gates.get(3)?.resolve(generated(3));
		gates.get(4)?.resolve(generated(4));

		await expect(run).resolves.toMatchObject({
			images: makeImages(4),
			status: "succeeded",
		});
		expect(maxActive).toBe(2);
	});

	it("serializes capture writes shared by parallel provider calls", async () => {
		const captureGates = [deferred<void>(), deferred<void>()];
		let activeCaptures = 0;
		let captureIndex = 0;
		let maxActiveCaptures = 0;
		const dependencies = makeDependencies({
			capture: vi.fn(async () => {
				const gate = captureGates[captureIndex] as Deferred<void>;
				captureIndex += 1;
				activeCaptures += 1;
				maxActiveCaptures = Math.max(maxActiveCaptures, activeCaptures);
				await gate.promise;
				activeCaptures -= 1;
			}),
			generateOne: vi.fn(
				async (_attempt, _subject, index, _signal, onProviderGeneration) => {
					const result = generated(index);
					await onProviderGeneration?.(result);
					return result;
				},
			),
		});
		const run = runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_serial_capture",
		});

		await vi.waitFor(() =>
			expect(dependencies.capture).toHaveBeenCalledTimes(1),
		);
		expect(dependencies.generateOne).toHaveBeenCalledTimes(2);
		captureGates[0]?.resolve();
		await vi.waitFor(() =>
			expect(dependencies.capture).toHaveBeenCalledTimes(2),
		);
		expect(maxActiveCaptures).toBe(1);
		captureGates[1]?.resolve();

		await expect(run).resolves.toMatchObject({ status: "succeeded" });
		expect(maxActiveCaptures).toBe(1);
	});

	it("persists partial progress in completion order and sorts each snapshot", async () => {
		const gates = [
			deferred<ImageGenerationProviderResult>(),
			deferred<ImageGenerationProviderResult>(),
		];
		const dependencies = makeDependencies({
			generateOne: vi.fn((_attempt, _subject, index) => {
				return (gates[index - 1] as Deferred<ImageGenerationProviderResult>)
					.promise;
			}),
		});
		const run = runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_progress_order",
		});

		await vi.waitFor(() =>
			expect(dependencies.generateOne).toHaveBeenCalledTimes(2),
		);
		gates[1]?.resolve(generated(2));
		await vi.waitFor(() =>
			expect(dependencies.persistProgress).toHaveBeenCalledTimes(1),
		);
		expect(dependencies.persistProgress).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ id: ATTEMPT_ID }),
			[makeImages(2)[1]],
		);

		gates[0]?.resolve(generated(1));
		await expect(run).resolves.toEqual({
			images: makeImages(2),
			recovered: false,
			status: "succeeded",
		});
		expect(dependencies.persistProgress).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ id: ATTEMPT_ID }),
			makeImages(2),
		);
	});

	it("drains an in-flight sparse success after failure and settles captured units", async () => {
		const queued = makeAttempt({ count: 4 });
		const generating = makeAttempt({
			count: 4,
			startedAt: new Date("2026-01-01T00:00:00Z"),
			status: "generating",
		});
		const gates = new Map(
			[1, 2, 3, 4].map((index) => [
				index,
				deferred<ImageGenerationProviderResult>(),
			]),
		);
		const started: number[] = [];
		const reservation = { ...RESERVATION, credits: 20, units: 4 };
		const dependencies = makeDependencies({
			claimQueued: vi.fn().mockResolvedValue(generating),
			generateOne: vi.fn((_attempt, _subject, index) => {
				started.push(index);
				return (gates.get(index) as Deferred<ImageGenerationProviderResult>)
					.promise;
			}),
			loadAttempt: vi.fn().mockResolvedValue(queued),
			reserve: vi.fn().mockResolvedValue(reservation),
		});
		const run = runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_sparse_partial",
		});

		await vi.waitFor(() => expect(started).toEqual([1, 2]));
		gates.get(1)?.resolve(generated(1));
		await vi.waitFor(() => expect(started).toEqual([1, 2, 3]));
		gates.get(2)?.resolve({ message: "quota", status: "failed" });
		gates.get(3)?.resolve(generated(3));

		await expect(run).resolves.toEqual({
			images: [makeImages(4)[0], makeImages(4)[2]],
			recovered: false,
			status: "succeeded",
		});
		expect(started).toEqual([1, 2, 3]);
		expect(dependencies.capture).toHaveBeenCalledTimes(2);
		expect(dependencies.settle).toHaveBeenCalledWith(reservation, 2);
		expect(dependencies.markSucceeded).toHaveBeenCalledWith(
			generating,
			[makeImages(4)[0], makeImages(4)[2]],
			expect.any(Date),
		);
	});

	it("keeps terminal completion authoritative when progress persistence fails", async () => {
		const dependencies = makeDependencies({
			persistProgress: vi.fn().mockRejectedValue(new Error("database busy")),
		});

		await expect(
			runImageGeneration(PAYLOAD, {
				dependencies,
				runId: "run_progress_failure",
			}),
		).resolves.toMatchObject({ images: makeImages(2), status: "succeeded" });
		expect(dependencies.markSucceeded).toHaveBeenCalledWith(
			expect.anything(),
			makeImages(2),
			expect.any(Date),
		);
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

	it("publishes a stored partial subset after reconcile_failed without repricing", async () => {
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
					index: 1,
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
					index: 1,
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

	it("charges every provider-completed in-flight image when storage fails", async () => {
		const dependencies = makeDependencies({
			generateOne: vi.fn(
				async (_attempt, _subject, _index, _signal, onProviderGeneration) => {
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
		expect(dependencies.capture).toHaveBeenCalledTimes(2);
		expect(dependencies.settle).toHaveBeenCalledWith(RESERVATION, 2);
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
