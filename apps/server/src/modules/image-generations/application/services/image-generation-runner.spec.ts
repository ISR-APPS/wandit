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

const PAYLOAD = {
	attemptId: ATTEMPT_ID,
	projectId: PROJECT_ID,
	userId: USER_ID,
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
		projectDeletedAt: null,
		projectId: PROJECT_ID,
		prompt: "a product on a bench",
		sourceImageUrls: [],
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
		claimQueued: vi.fn().mockResolvedValue(generating),
		fail: vi.fn().mockResolvedValue(true),
		generateOne: vi.fn().mockImplementation((_attempt, index: number) =>
			Promise.resolve({
				mediaType: "image/png",
				status: "generated" as const,
				url: `https://assets.example.com/images/p/a/img-${index}.png`,
			}),
		),
		loadAttempt: vi.fn().mockResolvedValue(queued),
		markSucceeded: vi.fn().mockResolvedValue(true),
		now: () => new Date("2026-01-01T00:05:00Z"),
		recoverStoredImages: vi.fn().mockResolvedValue(null),
		refund: vi.fn().mockResolvedValue(undefined),
		reserve: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("parseImageGenerationPayload", () => {
	it("accepts the exact payload shape", () => {
		expect(parseImageGenerationPayload(PAYLOAD)).toEqual(PAYLOAD);
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

		const result = await runImageGeneration(PAYLOAD, {
			dependencies,
			runId: "run_1",
		});

		expect(dependencies.reserve).toHaveBeenCalledWith(USER_ID, ATTEMPT_ID);
		expect(dependencies.generateOne).toHaveBeenCalledTimes(2);
		expect(dependencies.generateOne).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ id: ATTEMPT_ID }),
			1,
			undefined,
		);
		expect(dependencies.generateOne).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ id: ATTEMPT_ID }),
			2,
			undefined,
		);
		expect(dependencies.markSucceeded).toHaveBeenCalledWith(
			expect.objectContaining({ id: ATTEMPT_ID }),
			makeImages(2),
			expect.any(Date),
		);
		expect(result).toEqual({
			images: makeImages(2),
			recovered: false,
			status: "succeeded",
		});
	});

	it("fails once and refunds once when any image fails", async () => {
		const dependencies = makeDependencies({
			generateOne: vi
				.fn()
				.mockResolvedValueOnce({
					mediaType: "image/png",
					status: "generated",
					url: "https://assets.example.com/images/p/a/img-1.png",
				})
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
		expect(dependencies.refund).toHaveBeenCalled();
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
		expect(result).toEqual({
			images: makeImages(2),
			recovered: true,
			status: "succeeded",
		});
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
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ATTEMPT_ID);
	});
});
