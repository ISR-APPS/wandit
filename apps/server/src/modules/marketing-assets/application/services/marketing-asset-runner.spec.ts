import { describe, expect, it, vi } from "vitest";
import { classifyAiError } from "../../../ai-errors/domain";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";

import type { MarketingAssetReservation } from "./marketing-asset-billing";
import {
	MARKETING_ASSET_STALE_GENERATING_MS,
	type MarketingAssetDocument,
	type MarketingAssetJob,
	type MarketingAssetProviderResult,
	type MarketingAssetRunnerDependencies,
	MarketingAssetSettlementPendingError,
	parseMarketingAssetPayload,
	runMarketingAssetGeneration,
	USER_SAFE_MARKETING_ASSET_ERROR,
} from "./marketing-asset-runner";

const ASSET_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user_123";
const SUBJECT = { actorUserId: USER_ID };
const PARENT_EVENT_ID = "44444444-4444-4444-8444-444444444444";
const R2_KEY = `marketing/${PROJECT_ID}/${ASSET_ID}/index.html`;
const NOW = new Date("2026-07-25T12:00:00.000Z");
const RESERVATION: MarketingAssetReservation = {
	credits: 5,
	eventId: "33333333-3333-4333-8333-333333333333",
	operation: "marketing" as const,
	referenceId: ASSET_ID,
	replay: "none" as const,
	terms: { mode: "token", usdMicrosPerCredit: 40_000 },
	units: 1,
};
// Token settlement of the generator's call (model + usage from evidence).
const TOKEN_SETTLEMENT = {
	completedUnits: 1,
	tokenUsage: {
		modelId: "google/gemini-2.5-pro",
		provider: null,
		rawUsage: { inputTokens: 10, outputTokens: 20 },
		usage: { inputTokens: 10, outputTokens: 20 },
	},
};

function internalFailure(message: string) {
	const failure = classifyAiError(new Error(message), {
		route: "none",
		surface: "marketing",
	});
	if (!failure) throw new Error("Expected a normalized failure");
	return failure;
}

describe("parseMarketingAssetPayload", () => {
	it("accepts only the exact handoff payload", () => {
		expect(
			parseMarketingAssetPayload({
				assetId: ASSET_ID,
				billingMode: "enforce",
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toEqual({
			assetId: ASSET_ID,
			billingMode: "enforce",
			organizationId: null,
			projectId: PROJECT_ID,
			userId: USER_ID,
		});
		expect(
			parseMarketingAssetPayload({
				assetId: ASSET_ID,
				billingMode: "enforce",
				parentEventId: PARENT_EVENT_ID,
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toEqual({
			assetId: ASSET_ID,
			billingMode: "enforce",
			organizationId: null,
			parentEventId: PARENT_EVENT_ID,
			projectId: PROJECT_ID,
			userId: USER_ID,
		});

		expect(() =>
			parseMarketingAssetPayload({
				assetId: ASSET_ID,
				billingMode: "enforce",
				extra: true,
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toThrow(
			/only assetId, optional billingMode, optional organizationId, optional parentEventId/,
		);
		expect(() =>
			parseMarketingAssetPayload({
				assetId: "not-a-uuid",
				billingMode: "enforce",
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toThrow(/assetId must be a UUID/);
	});
});

function makeAsset(
	overrides: Partial<MarketingAssetJob> = {},
): MarketingAssetJob {
	return {
		assetType: "ad-copy",
		brief: "BUSINESS: PulseBuds. FACTS: 8 900 DZD, +213 540 77 31 02.",
		completedAt: null,
		error: null,
		id: ASSET_ID,
		name: "Ads Meta — Lancement PulseBuds",
		organizationId: null,
		projectDeletedAt: null,
		projectId: PROJECT_ID,
		r2Key: null,
		startedAt: null,
		status: "queued",
		triggerRunId: null,
		userId: USER_ID,
		...overrides,
	};
}

function makeDependencies(
	asset: MarketingAssetJob,
	options: {
		generated?: MarketingAssetProviderResult;
		recovered?: MarketingAssetDocument | null;
	} = {},
) {
	const claimed: MarketingAssetJob = {
		...asset,
		startedAt: NOW,
		status: "generating",
	};

	return {
		capture: vi.fn(async () => undefined),
		claimQueued: vi.fn(async () => claimed),
		fail: vi.fn(async () => true),
		generate: vi.fn(
			async (
				_asset,
				_subject,
				_signal,
				onProviderGeneration,
			): Promise<MarketingAssetProviderResult> => {
				const generated = options.generated ?? {
					model: "google/gemini-2.5-pro",
					providerMetadata: { gateway: { generationId: "generation_1" } },
					r2Key: R2_KEY,
					status: "generated",
					usage: { inputTokens: 10, outputTokens: 20 },
				};
				if (generated.status === "generated") {
					await onProviderGeneration?.(generated);
				}
				return generated;
			},
		),
		loadAsset: vi.fn(async () => asset),
		markSucceeded: vi
			.fn<MarketingAssetRunnerDependencies["markSucceeded"]>()
			.mockResolvedValue(true),
		now: vi.fn(() => NOW),
		recoverStoredDocument: vi.fn(async () => options.recovered ?? null),
		refund: vi.fn(async () => undefined),
		reserve: vi.fn(async () => RESERVATION),
		settle: vi.fn(async () => undefined),
		settleExisting: vi.fn(async () => true),
	};
}

function payload() {
	return {
		assetId: ASSET_ID,
		billingMode: "enforce" as const,
		projectId: PROJECT_ID,
		userId: USER_ID,
	};
}

describe("runMarketingAssetGeneration", () => {
	it("claims queued work, reserves once, and invokes the generator once", async () => {
		const asset = makeAsset();
		const dependencies = makeDependencies(asset);

		const result = await runMarketingAssetGeneration(payload(), {
			dependencies,
			runId: "run_123",
		});

		expect(result).toEqual({
			r2Key: R2_KEY,
			recovered: false,
			status: "succeeded",
		});
		expect(dependencies.claimQueued).toHaveBeenCalledWith(asset, {
			runId: "run_123",
			startedAt: NOW,
		});
		expect(dependencies.reserve).toHaveBeenCalledWith(
			SUBJECT,
			ASSET_ID,
			undefined,
			"enforce",
		);
		expect(dependencies.capture).toHaveBeenCalledTimes(1);
		expect(dependencies.generate).toHaveBeenCalledTimes(1);
		expect(dependencies.markSucceeded).toHaveBeenCalledTimes(1);
		expect(dependencies.markSucceeded.mock.calls[0]?.[3]).toBe(USER_ID);
		expect(dependencies.settle).toHaveBeenCalledWith(
			RESERVATION,
			TOKEN_SETTLEMENT,
		);
		expect(dependencies.settle.mock.invocationCallOrder[0]).toBeLessThan(
			dependencies.markSucceeded.mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
	});

	it("does not refund after settlement when deletion wins the success CAS", async () => {
		const queued = makeAsset();
		const deletedGenerating = makeAsset({
			projectDeletedAt: NOW,
			startedAt: NOW,
			status: "generating",
		});
		const dependencies = makeDependencies(queued);
		dependencies.loadAsset
			.mockResolvedValueOnce(queued)
			.mockResolvedValueOnce(deletedGenerating);
		dependencies.markSucceeded.mockResolvedValueOnce(false);

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_deleted_after_settle",
			}),
		).resolves.toEqual({ reason: "project_deleted", status: "failed" });
		expect(dependencies.settle).toHaveBeenCalledWith(
			RESERVATION,
			TOKEN_SETTLEMENT,
		);
		expect(dependencies.fail).toHaveBeenCalledOnce();
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("fails without refund or provider replay after reconcile_failed", async () => {
		const dependencies = makeDependencies(makeAsset());
		dependencies.reserve.mockResolvedValue({
			...RESERVATION,
			replay: "reconcile_failed",
		});

		await expect(
			runMarketingAssetGeneration(payload(), {
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

	it("fails and refunds when the generator reports failure", async () => {
		const asset = makeAsset();
		const dependencies = makeDependencies(asset, {
			generated: { message: "model unavailable", status: "unavailable" },
		});

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_fail",
			}),
		).resolves.toEqual({ reason: "generation_failed", status: "failed" });
		expect(dependencies.fail).toHaveBeenCalledWith(
			expect.objectContaining({ status: "generating" }),
			expect.objectContaining({
				completedAt: NOW,
				error: USER_SAFE_MARKETING_ASSET_ERROR,
				expectedStatus: "generating",
				failureKind: "internal",
				failureSource: "ours",
				reason: "generation_failed",
			}),
		);
		expect(dependencies.refund).toHaveBeenCalledWith(SUBJECT, ASSET_ID);
	});

	it("charges a captured provider-completed document when R2 storage fails", async () => {
		const asset = makeAsset();
		const dependencies = makeDependencies(asset);
		dependencies.generate.mockImplementationOnce(
			async (_asset, _signal, onProviderGeneration) => {
				const generation = {
					model: "google/gemini-2.5-pro",
					providerMetadata: {
						gateway: { generationId: "generation-storage-failure" },
					},
					usage: { inputTokens: 10, outputTokens: 20 },
				};
				await onProviderGeneration?.(generation);
				return {
					...generation,
					failure: internalFailure("R2 unavailable"),
					message: "R2 unavailable",
					providerUnits: 1,
					status: "failed" as const,
				};
			},
		);

		await expect(
			runMarketingAssetGeneration(payload(), {
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
		expect(dependencies.settle).toHaveBeenCalledWith(
			RESERVATION,
			TOKEN_SETTLEMENT,
		);
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("fails and refunds when the reservation is rejected", async () => {
		const asset = makeAsset();
		const dependencies = makeDependencies(asset);
		dependencies.reserve.mockRejectedValueOnce(new Error("no credits"));

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_reserve",
			}),
		).resolves.toEqual({ reason: "reservation_failed", status: "failed" });
		expect(dependencies.generate).not.toHaveBeenCalled();
		expect(dependencies.refund).toHaveBeenCalledWith(SUBJECT, ASSET_ID);
	});

	it("persists an insufficient-credit reservation rejection as billing", async () => {
		const asset = makeAsset();
		const dependencies = makeDependencies(asset);
		dependencies.reserve.mockRejectedValueOnce(
			new InsufficientCreditsError(500, 0),
		);

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_billing_rejection",
			}),
		).resolves.toEqual({ reason: "reservation_failed", status: "failed" });
		expect(dependencies.fail).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				error: "Not enough credits for this action.",
				failureKind: "billing",
				failureSource: "ours",
				sentryEventId: null,
			}),
		);
		expect(dependencies.generate).not.toHaveBeenCalled();
	});

	it("settles an already-failed row with a refund and no generation", async () => {
		const failed = makeAsset({
			completedAt: NOW,
			error: "x",
			status: "failed",
		});
		const dependencies = makeDependencies(failed);

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_prior",
			}),
		).resolves.toEqual({ reason: "already_failed", status: "failed" });
		expect(dependencies.generate).not.toHaveBeenCalled();
		expect(dependencies.refund).toHaveBeenCalledWith(SUBJECT, ASSET_ID);
	});

	it("returns a succeeded row untouched", async () => {
		const succeeded = makeAsset({
			completedAt: NOW,
			r2Key: R2_KEY,
			status: "succeeded",
		});
		const dependencies = makeDependencies(succeeded);

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_done",
			}),
		).resolves.toEqual({
			r2Key: R2_KEY,
			recovered: false,
			status: "succeeded",
		});
		expect(dependencies.claimQueued).not.toHaveBeenCalled();
		expect(dependencies.generate).not.toHaveBeenCalled();
	});

	it("publishes a stored document after reconcile_failed without repricing", async () => {
		const generating = makeAsset({
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
		});
		const dependencies = makeDependencies(generating, {
			recovered: { r2Key: R2_KEY },
		});

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_recover",
			}),
		).resolves.toEqual({
			r2Key: R2_KEY,
			recovered: true,
			status: "succeeded",
		});
		expect(dependencies.generate).not.toHaveBeenCalled();
		expect(dependencies.markSucceeded).toHaveBeenCalledTimes(1);
		expect(dependencies.markSucceeded.mock.calls[0]?.[3]).toBe(USER_ID);
		expect(dependencies.settleExisting).toHaveBeenCalledWith(SUBJECT, ASSET_ID);
		expect(dependencies.reserve).not.toHaveBeenCalled();
		expect(dependencies.settle).not.toHaveBeenCalled();
		expect(
			dependencies.settleExisting.mock.invocationCallOrder[0],
		).toBeLessThan(
			dependencies.markSucceeded.mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
	});

	it("fails closed when enforced stored-document recovery has no metering event", async () => {
		const generating = makeAsset({
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
		});
		const dependencies = makeDependencies(generating, {
			recovered: { r2Key: R2_KEY },
		});
		dependencies.settleExisting.mockResolvedValueOnce(false);

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_missing_metering",
			}),
		).rejects.toThrow("no enforced metering event");
		expect(dependencies.markSucceeded).not.toHaveBeenCalled();
		expect(dependencies.generate).not.toHaveBeenCalled();
	});

	it("keeps retrying a fresh generating row without a stored document", async () => {
		const generating = makeAsset({
			startedAt: new Date(NOW.getTime() - 60_000),
			status: "generating",
		});
		const dependencies = makeDependencies(generating);

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_pending",
			}),
		).rejects.toBeInstanceOf(MarketingAssetSettlementPendingError);
		expect(dependencies.fail).not.toHaveBeenCalled();
		expect(dependencies.refund).not.toHaveBeenCalled();
	});

	it("fails and refunds a stale generating row without a stored document", async () => {
		const generating = makeAsset({
			startedAt: new Date(
				NOW.getTime() - MARKETING_ASSET_STALE_GENERATING_MS - 1,
			),
			status: "generating",
		});
		const dependencies = makeDependencies(generating);

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_stale",
			}),
		).resolves.toEqual({ reason: "stale_generation", status: "failed" });
		expect(dependencies.refund).toHaveBeenCalledWith(SUBJECT, ASSET_ID);
	});

	it("fails and refunds queued work when its project was soft-deleted", async () => {
		const deleted = makeAsset({ projectDeletedAt: NOW });
		const dependencies = makeDependencies(deleted);

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_deleted",
			}),
		).resolves.toEqual({ reason: "project_deleted", status: "failed" });
		expect(dependencies.fail).toHaveBeenCalledWith(deleted, {
			completedAt: NOW,
			error: USER_SAFE_MARKETING_ASSET_ERROR,
			expectedStatus: "queued",
			failureKind: "internal",
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: "ours",
			reason: "project_deleted",
			sentryEventId: expect.any(String),
		});
		expect(dependencies.claimQueued).not.toHaveBeenCalled();
		expect(dependencies.generate).not.toHaveBeenCalled();
	});

	it("refunds and reports ownership mismatches without touching the row", async () => {
		const dependencies = makeDependencies(makeAsset());
		dependencies.loadAsset.mockResolvedValueOnce(null as never);

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_missing",
			}),
		).resolves.toEqual({ reason: "ownership_mismatch", status: "failed" });
		expect(dependencies.refund).toHaveBeenCalledWith(SUBJECT, ASSET_ID);
		expect(dependencies.claimQueued).not.toHaveBeenCalled();
	});
});
