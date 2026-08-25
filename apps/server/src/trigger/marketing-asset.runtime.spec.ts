import { beforeEach, describe, expect, it, vi } from "vitest";

import { LifecycleEventsService } from "../modules/lifecycle-events/application/services/lifecycle-events.service";
import type { MarketingAssetJob } from "../modules/marketing-assets/application/services/marketing-asset-runner";
import { createMarketingAssetRuntime } from "./marketing-asset.runtime";

vi.mock("./metering.runtime", () => ({
	createTriggerMetering: vi.fn(() => ({})),
}));

const ASSET: MarketingAssetJob = {
	assetType: "marketing-strategy",
	brief: "Launch plan",
	completedAt: null,
	error: null,
	id: "11111111-1111-4111-8111-111111111111",
	name: "Launch strategy",
	organizationId: "org_1",
	projectDeletedAt: null,
	projectId: "22222222-2222-4222-8222-222222222222",
	r2Key: null,
	startedAt: new Date("2026-08-24T11:55:00.000Z"),
	status: "generating",
	triggerRunId: "run_1",
	userId: "project_creator_1",
};

const enqueueLifecycleEvent = vi.spyOn(
	LifecycleEventsService.prototype,
	"enqueue",
);

function successfulUpdateDatabase() {
	const returning = vi.fn().mockResolvedValue([{ id: ASSET.id }]);
	const where = vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));
	const transactionClient = { update };
	const transaction = vi.fn(
		async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
			callback(transactionClient),
	);

	return {
		db: { transaction } as unknown as Parameters<
			typeof createMarketingAssetRuntime
		>[0],
		transactionClient,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	enqueueLifecycleEvent.mockResolvedValue(null);
});

describe("marketing-asset Trigger runtime lifecycle capture", () => {
	it("enqueues marketing_strategy_generated for the queue actor", async () => {
		const { db, transactionClient } = successfulUpdateDatabase();
		const capture = vi.fn();
		const runtime = createMarketingAssetRuntime(db, { capture });

		await expect(
			runtime.runner.markSucceeded(
				ASSET,
				{ r2Key: "marketing/strategy/index.html" },
				new Date("2026-08-24T12:00:00.000Z"),
				"acting_member_1",
			),
		).resolves.toBe(true);

		expect(enqueueLifecycleEvent).toHaveBeenCalledExactlyOnceWith(
			{
				event: "marketing_strategy_generated",
				idempotencyKey: "marketing_strategy_generated:acting_member_1",
				userId: "acting_member_1",
			},
			transactionClient,
		);
		expect(capture).toHaveBeenCalledWith(
			"acting_member_1",
			"generation_completed",
			expect.any(Object),
		);
	});

	it("does not enqueue for another marketing asset type", async () => {
		const { db } = successfulUpdateDatabase();
		const runtime = createMarketingAssetRuntime(db, { capture: vi.fn() });

		await expect(
			runtime.runner.markSucceeded(
				{ ...ASSET, assetType: "ad-copy" },
				{ r2Key: "marketing/ad-copy/index.html" },
				new Date("2026-08-24T12:00:00.000Z"),
				"acting_member_1",
			),
		).resolves.toBe(true);

		expect(enqueueLifecycleEvent).not.toHaveBeenCalled();
	});

	it("propagates an unexpected transactional enqueue failure", async () => {
		const { db } = successfulUpdateDatabase();
		const runtime = createMarketingAssetRuntime(db, { capture: vi.fn() });
		enqueueLifecycleEvent.mockRejectedValueOnce(
			new Error("lifecycle insert failed"),
		);

		await expect(
			runtime.runner.markSucceeded(
				ASSET,
				{ r2Key: "marketing/strategy/index.html" },
				new Date("2026-08-24T12:00:00.000Z"),
				"acting_member_1",
			),
		).rejects.toThrow("lifecycle insert failed");
	});
});
