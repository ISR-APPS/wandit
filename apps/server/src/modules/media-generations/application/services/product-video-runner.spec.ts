import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type ProductVideoAttempt,
	type ProductVideoRunnerDependencies,
	parseProductVideoPayload,
	runProductVideo,
} from "./product-video-runner";
import type { VideoReservation } from "./video-billing";

const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user_123";
const NOW = new Date("2026-08-23T12:00:00.000Z");
const SUBJECT = { actorUserId: USER_ID };
const RESERVATION: VideoReservation = {
	credits: 550,
	eventId: "33333333-3333-4333-8333-333333333333",
	operation: "video",
	referenceId: ATTEMPT_ID,
	replay: "none",
	terms: {
		estimatedUnitUsdMicros: null,
		mode: "measured",
		unit: "video",
		usdMicrosPerCredit: 40_000,
	},
	units: 1,
};

function payload() {
	return {
		attemptId: ATTEMPT_ID,
		billingMode: "enforce" as const,
		projectId: PROJECT_ID,
		userId: USER_ID,
	};
}

function makeAttempt(
	overrides: Partial<ProductVideoAttempt> = {},
): ProductVideoAttempt {
	return {
		aspect: "9:16",
		completedAt: null,
		durationSeconds: 5,
		error: null,
		id: ATTEMPT_ID,
		kind: "video-product",
		model: "bytedance/seedance-2.5",
		organizationId: null,
		projectDeletedAt: null,
		projectId: PROJECT_ID,
		prompt: "A deterministic studio orbit.",
		sourceImageUrl: "https://assets.test/product.png",
		sourceMediaType: "image/png",
		startedAt: null,
		status: "queued",
		triggerRunId: null,
		userId: USER_ID,
		videoMediaType: null,
		videoUrl: null,
		...overrides,
	};
}

function makeDependencies(attempt: ProductVideoAttempt) {
	const claimed = {
		...attempt,
		startedAt: NOW,
		status: "generating" as const,
		triggerRunId: "run_1",
	};
	const capture = vi
		.fn<ProductVideoRunnerDependencies["capture"]>()
		.mockResolvedValue(undefined);
	const claimQueued = vi
		.fn<ProductVideoRunnerDependencies["claimQueued"]>()
		.mockResolvedValue(claimed);
	const deliveredUnitsForAttempt = vi
		.fn<ProductVideoRunnerDependencies["deliveredUnitsForAttempt"]>()
		.mockResolvedValue(0);
	const fail = vi
		.fn<ProductVideoRunnerDependencies["fail"]>()
		.mockResolvedValue(true);
	const generate = vi
		.fn<ProductVideoRunnerDependencies["generate"]>()
		.mockImplementation(async (_attempt, _subject, input) => {
			await input.onProviderGeneration({
				model: "bytedance/seedance-2.5",
				providerMetadata: { gateway: { generationId: "generation_1" } },
			});
			input.onPublishing();
			return {
				mediaType: "video/mp4",
				model: "bytedance/seedance-2.5",
				providerMetadata: { gateway: { generationId: "generation_1" } },
				status: "generated",
				url: "https://assets.test/product-video.mp4",
			};
		});
	const loadAttempt = vi
		.fn<ProductVideoRunnerDependencies["loadAttempt"]>()
		.mockResolvedValue(attempt);
	const markSucceeded = vi
		.fn<ProductVideoRunnerDependencies["markSucceeded"]>()
		.mockResolvedValue(true);
	const now = vi
		.fn<ProductVideoRunnerDependencies["now"]>()
		.mockReturnValue(NOW);
	const recoverStoredVideo = vi
		.fn<ProductVideoRunnerDependencies["recoverStoredVideo"]>()
		.mockResolvedValue(null);
	const refund = vi
		.fn<ProductVideoRunnerDependencies["refund"]>()
		.mockResolvedValue(undefined);
	const reserve = vi
		.fn<ProductVideoRunnerDependencies["reserve"]>()
		.mockResolvedValue(RESERVATION);
	const settle = vi
		.fn<ProductVideoRunnerDependencies["settle"]>()
		.mockResolvedValue(undefined);
	const settleExisting = vi
		.fn<ProductVideoRunnerDependencies["settleExisting"]>()
		.mockResolvedValue(true);
	const dependencies: ProductVideoRunnerDependencies = {
		capture,
		claimQueued,
		deliveredUnitsForAttempt,
		fail,
		generate,
		loadAttempt,
		markSucceeded,
		now,
		recoverStoredVideo,
		refund,
		reserve,
		settle,
		settleExisting,
	};

	return {
		capture,
		claimed,
		claimQueued,
		deliveredUnitsForAttempt,
		dependencies,
		fail,
		generate,
		loadAttempt,
		markSucceeded,
		recoverStoredVideo,
		refund,
		reserve,
		settle,
		settleExisting,
	};
}

describe("parseProductVideoPayload", () => {
	it("accepts only the minimal durable handoff payload", () => {
		expect(parseProductVideoPayload(payload())).toEqual({
			...payload(),
			organizationId: null,
		});
		expect(() =>
			parseProductVideoPayload({ ...payload(), extra: true }),
		).toThrow(/must contain only/);
		expect(() =>
			parseProductVideoPayload({ ...payload(), attemptId: "not-a-uuid" }),
		).toThrow(/attemptId must be a UUID/);
	});
});

describe("runProductVideo", () => {
	beforeEach(() => vi.clearAllMocks());

	it("captures before delivery and settles before publishing success", async () => {
		const attempt = makeAttempt();
		const {
			capture,
			claimed,
			dependencies,
			generate,
			markSucceeded,
			reserve,
			settle,
		} = makeDependencies(attempt);
		const describe = vi.fn();
		const report = vi.fn();

		await expect(
			runProductVideo(payload(), {
				dependencies,
				progress: { describe, report },
				runId: "run_1",
			}),
		).resolves.toEqual({
			mediaType: "video/mp4",
			recovered: false,
			status: "succeeded",
			url: "https://assets.test/product-video.mp4",
		});

		expect(reserve).toHaveBeenCalledWith(
			SUBJECT,
			ATTEMPT_ID,
			1,
			undefined,
			"enforce",
			{
				audio: false,
				durationSeconds: 5,
				kind: "video-product",
				modelId: "bytedance/seedance-2.5",
			},
		);
		expect(generate).toHaveBeenCalledTimes(1);
		expect(describe).toHaveBeenCalledTimes(1);
		expect(describe).toHaveBeenCalledWith(
			expect.objectContaining({ aspect: "9:16", durationSeconds: 5 }),
		);
		expect(describe.mock.invocationCallOrder[0]).toBeLessThan(
			report.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
		expect(capture).toHaveBeenCalledTimes(1);
		expect(capture.mock.invocationCallOrder[0]).toBeLessThan(
			report.mock.invocationCallOrder[1] ?? Number.MAX_SAFE_INTEGER,
		);
		expect(settle).toHaveBeenCalledWith(RESERVATION, 1);
		expect(settle.mock.invocationCallOrder[0]).toBeLessThan(
			markSucceeded.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
		expect(markSucceeded).toHaveBeenCalledWith(
			claimed,
			expect.objectContaining({ status: "generated" }),
			NOW,
		);
		expect(report).toHaveBeenCalledWith(
			expect.objectContaining({ stage: "rendering" }),
		);
		expect(report).toHaveBeenCalledWith(
			expect.objectContaining({ stage: "publishing" }),
		);
	});

	it("refunds a failure with no provider evidence", async () => {
		const { dependencies, fail, generate, refund, settle } = makeDependencies(
			makeAttempt(),
		);
		generate.mockResolvedValue({
			message: "provider unavailable before admission",
			status: "unavailable",
		});

		await expect(
			runProductVideo(payload(), { dependencies, runId: "run_1" }),
		).resolves.toEqual({ reason: "generation_failed", status: "failed" });

		expect(settle).not.toHaveBeenCalled();
		expect(fail).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ reason: "product_provider_failed" }),
		);
		expect(refund).toHaveBeenCalledWith(SUBJECT, ATTEMPT_ID, "video-product");
	});

	it("settles evidence-backed failed work before failure and never refunds it", async () => {
		const { dependencies, fail, generate, refund, settle } = makeDependencies(
			makeAttempt(),
		);
		generate.mockImplementation(async (_attempt, _subject, input) => {
			await input.onProviderGeneration({
				model: "bytedance/seedance-2.5",
				providerMetadata: { gateway: { generationId: "generation_1" } },
			});
			return {
				message: "R2 upload failed after provider delivery",
				model: "bytedance/seedance-2.5",
				providerMetadata: { gateway: { generationId: "generation_1" } },
				providerUnits: 1,
				status: "failed",
			};
		});

		await expect(
			runProductVideo(payload(), { dependencies, runId: "run_1" }),
		).resolves.toEqual({ reason: "generation_failed", status: "failed" });

		expect(settle).toHaveBeenCalledWith(RESERVATION, 1);
		expect(settle.mock.invocationCallOrder[0]).toBeLessThan(
			fail.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
		expect(refund).not.toHaveBeenCalled();
	});

	it("recovers deterministic output without replaying the provider", async () => {
		const attempt = makeAttempt({
			startedAt: NOW,
			status: "generating",
			triggerRunId: "run_original",
		});
		const {
			dependencies,
			generate,
			markSucceeded,
			recoverStoredVideo,
			settleExisting,
		} = makeDependencies(attempt);
		recoverStoredVideo.mockResolvedValue({
			mediaType: "video/mp4",
			url: "https://assets.test/recovered.mp4",
		});

		await expect(
			runProductVideo(payload(), {
				dependencies,
				runId: "run_duplicate",
			}),
		).resolves.toEqual({
			mediaType: "video/mp4",
			recovered: true,
			status: "succeeded",
			url: "https://assets.test/recovered.mp4",
		});
		expect(generate).not.toHaveBeenCalled();
		expect(settleExisting).toHaveBeenCalledWith(SUBJECT, ATTEMPT_ID, 1);
		expect(settleExisting.mock.invocationCallOrder[0]).toBeLessThan(
			markSucceeded.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
	});
});
