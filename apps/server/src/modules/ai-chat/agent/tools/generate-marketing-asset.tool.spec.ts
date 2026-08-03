import { tasks } from "@trigger.dev/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import type { MarketingAssetsRepository } from "../../../marketing-assets/infrastructure/persistence/marketing-assets.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import { createGenerateMarketingAssetTool } from "./generate-marketing-asset.tool";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test",
	GENERATION_BILLING_MODE: "enforce",
	R2_PUBLIC_BASE_URL: "https://assets.example.com",
	TRIGGER_SECRET_KEY: "tr_dev_test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));
vi.mock("@trigger.dev/sdk", () => ({
	auth: { createPublicToken: vi.fn() },
	idempotencyKeys: { create: vi.fn() },
	tasks: { trigger: vi.fn() },
}));
vi.mock("../../../../infrastructure/storage/r2", () => ({
	isR2Configured: vi.fn(),
}));

beforeEach(() => {
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(isR2Configured).mockReturnValue(true);
	vi.mocked(tasks.trigger).mockReset();
});

describe("generate_marketing_asset billing", () => {
	it("does not queue a new asset when its reservation already settled", async () => {
		const assetId = "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3";
		const marketingAssetsRepository = {
			insertAsset: vi.fn().mockResolvedValue({
				created: true,
				id: assetId,
				status: "queued",
			}),
		};
		const meteringService = {
			findByIdempotencyKey: vi.fn().mockResolvedValue(null),
			reserveWithReplay: vi.fn().mockResolvedValue({
				event: { id: "usage_event_1", status: "settled" },
				replay: "settled",
				replayed: true,
			}),
		};
		const marketingTool = createGenerateMarketingAssetTool({
			chatId: "chat_1",
			marketingAssetsRepository:
				marketingAssetsRepository as unknown as MarketingAssetsRepository,
			meteringService: meteringService as unknown as MeteringService,
			projectId: "project_1",
			subject: { actorUserId: "user_1" },
			userId: "user_1",
		});
		const run = marketingTool.execute;

		if (!run) {
			throw new Error("generate_marketing_asset tool must have execute");
		}

		await expect(
			run(
				{
					assetType: "ad-copy",
					brief:
						"Create a concise launch campaign for a real product with two variants.",
					title: "Launch campaign",
				},
				{ messages: [], toolCallId: "call_1" } as unknown as Parameters<
					typeof run
				>[1],
			),
		).rejects.toBeInstanceOf(MeteringStateConflictError);
		expect(tasks.trigger).not.toHaveBeenCalled();
	});
});
