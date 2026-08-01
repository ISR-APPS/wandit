import { describe, expect, it, vi } from "vitest";

import {
	MARKETING_ASSET_STALE_GENERATING_MS,
	type MarketingAssetDocument,
	type MarketingAssetJob,
	type MarketingAssetProviderResult,
	MarketingAssetSettlementPendingError,
	parseMarketingAssetPayload,
	runMarketingAssetGeneration,
	USER_SAFE_MARKETING_ASSET_ERROR,
} from "./marketing-asset-runner";

const ASSET_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user_123";
const R2_KEY = `marketing/${PROJECT_ID}/${ASSET_ID}/index.html`;
const NOW = new Date("2026-07-25T12:00:00.000Z");

describe("parseMarketingAssetPayload", () => {
	it("accepts only the exact handoff payload", () => {
		expect(
			parseMarketingAssetPayload({
				assetId: ASSET_ID,
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toEqual({
			assetId: ASSET_ID,
			projectId: PROJECT_ID,
			userId: USER_ID,
		});

		expect(() =>
			parseMarketingAssetPayload({
				assetId: ASSET_ID,
				extra: true,
				projectId: PROJECT_ID,
				userId: USER_ID,
			}),
		).toThrow(/only assetId, projectId, and userId/);
		expect(() =>
			parseMarketingAssetPayload({
				assetId: "not-a-uuid",
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
		claimQueued: vi.fn(async () => claimed),
		fail: vi.fn(async () => true),
		generate: vi.fn(
			async (): Promise<MarketingAssetProviderResult> =>
				options.generated ?? { r2Key: R2_KEY, status: "generated" },
		),
		loadAsset: vi.fn(async () => asset),
		markSucceeded: vi.fn(async () => true),
		now: vi.fn(() => NOW),
		recoverStoredDocument: vi.fn(async () => options.recovered ?? null),
		refund: vi.fn(async () => undefined),
		reserve: vi.fn(async () => undefined),
	};
}

function payload() {
	return { assetId: ASSET_ID, projectId: PROJECT_ID, userId: USER_ID };
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
		expect(dependencies.reserve).toHaveBeenCalledWith(USER_ID, ASSET_ID);
		expect(dependencies.generate).toHaveBeenCalledTimes(1);
		expect(dependencies.markSucceeded).toHaveBeenCalledTimes(1);
	});

	it("fails and refunds when the generator reports failure", async () => {
		const asset = makeAsset();
		const dependencies = makeDependencies(asset, {
			generated: { message: "model unavailable", status: "failed" },
		});

		await expect(
			runMarketingAssetGeneration(payload(), {
				dependencies,
				runId: "run_fail",
			}),
		).resolves.toEqual({ reason: "generation_failed", status: "failed" });
		expect(dependencies.fail).toHaveBeenCalledWith(
			expect.objectContaining({ status: "generating" }),
			{
				completedAt: NOW,
				error: USER_SAFE_MARKETING_ASSET_ERROR,
				expectedStatus: "generating",
				reason: "generation_failed",
			},
		);
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ASSET_ID);
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
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ASSET_ID);
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
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ASSET_ID);
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

	it("recovers a generating row from its deterministic stored document", async () => {
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
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ASSET_ID);
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
			reason: "project_deleted",
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
		expect(dependencies.refund).toHaveBeenCalledWith(USER_ID, ASSET_ID);
		expect(dependencies.claimQueued).not.toHaveBeenCalled();
	});
});
