import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getObjectContentType,
	marketingAssetKey,
} from "../../../../infrastructure/storage/r2";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	MarketingAssetRow,
	MarketingAssetsRepository,
} from "../../infrastructure/persistence/marketing-assets.repository";

const aiErrorMocks = vi.hoisted(() => ({
	captureAiError: vi.fn(() => "marketing-sentry-event"),
}));

vi.mock("../../../ai-errors/domain", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../../ai-errors/domain")>()),
	captureAiError: aiErrorMocks.captureAiError,
}));

import { MarketingAssetsService } from "./marketing-assets.service";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	getObjectContentType: vi.fn(),
	getPageHtml: vi.fn(),
	marketingAssetKey: vi.fn(
		(projectId: string, assetId: string) =>
			`sites/${projectId}/marketing/${assetId}.html`,
	),
}));

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

const SCOPE: ProjectScope = { kind: "personal", userId: "user_1" };

const BASE_ROW: MarketingAssetRow = {
	assetType: "ad-copy",
	completedAt: null,
	createdAt: new Date("2026-07-24T10:00:00.000Z"),
	error: null,
	failureKind: null,
	failureProvider: null,
	failureProviderMessage: null,
	failureRequestId: null,
	failureSource: null,
	id: "11111111-1111-4111-8111-111111111111",
	name: "Launch ad",
	projectId: "22222222-2222-4222-8222-222222222222",
	r2Key: null,
	sentryEventId: null,
	status: "generating",
};

function setup() {
	const succeededRow: MarketingAssetRow = {
		...BASE_ROW,
		completedAt: new Date(),
		r2Key: `sites/${BASE_ROW.projectId}/marketing/${BASE_ROW.id}.html`,
		status: "succeeded",
	};
	const repository = {
		listForProject: vi
			.fn()
			.mockResolvedValueOnce([BASE_ROW])
			.mockResolvedValueOnce([succeededRow]),
	};
	const usageEvent = {
		id: "usage_event_marketing",
		operation: "marketing",
	} as Awaited<ReturnType<MeteringService["reserve"]>>;
	const meteringService = {
		findByIdempotencyKey: vi.fn().mockResolvedValue(usageEvent),
		refund: vi.fn(),
		settleMeasuredFromEvidence: vi.fn().mockResolvedValue(usageEvent),
	};
	const selectLimit = vi
		.fn()
		.mockResolvedValue([{ startedAt: new Date(Date.now() - 20 * 60 * 1_000) }]);
	const updateReturning = vi
		.fn()
		.mockResolvedValue([{ projectId: BASE_ROW.projectId }]);
	const updateSet = vi.fn(() => ({
		where: vi.fn(() => ({ returning: updateReturning })),
	}));
	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit: selectLimit })),
			})),
		})),
		update: vi.fn(() => ({ set: updateSet })),
	};
	const analytics = { capture: vi.fn() };
	const service = new MarketingAssetsService(
		repository as unknown as MarketingAssetsRepository,
		meteringService as unknown as MeteringService,
		db as never,
		analytics as never,
	);

	return {
		db,
		meteringService,
		repository,
		service,
		updateReturning,
		updateSet,
	};
}

beforeEach(() => {
	vi.mocked(getObjectContentType).mockReset();
	vi.mocked(getObjectContentType).mockResolvedValue("text/html");
	vi.mocked(marketingAssetKey).mockClear();
	aiErrorMocks.captureAiError.mockClear();
});

describe("MarketingAssetsService stale recovery billing", () => {
	it("maps persisted normalized failure columns into the response", async () => {
		const { repository, service } = setup();
		repository.listForProject.mockReset().mockResolvedValue([
			{
				...BASE_ROW,
				completedAt: new Date("2026-07-24T10:05:00.000Z"),
				error:
					"Anthropic declined this request because of its content rules. Change the prompt and try again.",
				failureKind: "content_moderated",
				failureProvider: "anthropic",
				failureProviderMessage: "sexual content",
				failureRequestId: "gen_marketing_1",
				failureSource: "openrouter",
				status: "failed",
			},
		]);

		const result = await service.list(SCOPE, BASE_ROW.projectId);

		expect(result.assets[0]?.failure).toEqual({
			kind: "content_moderated",
			moderationStage: null,
			providerLabel: "Anthropic",
			providerMessage: "sexual content",
			refunded: false,
			requestId: "gen_marketing_1",
			retryable: false,
			source: "openrouter",
			terminal: true,
		});
	});

	it("reports a proven no-evidence provider failure as refunded", async () => {
		const { repository, service } = setup();
		repository.listForProject.mockReset().mockResolvedValue([
			{
				...BASE_ROW,
				completedAt: new Date("2026-07-24T10:05:00.000Z"),
				error: "The AI provider is over capacity.",
				failureKind: "capacity",
				failureProvider: "anthropic",
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: "provider:anthropic",
				status: "failed",
			},
		]);

		const result = await service.list(SCOPE, BASE_ROW.projectId);

		expect(result.assets[0]?.failure).toMatchObject({
			kind: "capacity",
			refunded: true,
		});
	});

	it("settles an existing hold before publishing a recovered document", async () => {
		const { db, meteringService, service, updateSet } = setup();

		await expect(
			service.list(SCOPE, BASE_ROW.projectId),
		).resolves.toMatchObject({
			assets: [{ id: BASE_ROW.id, status: "succeeded" }],
		});
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			`marketing:${BASE_ROW.id}`,
			{ actorUserId: "user_1" },
		);
		expect(meteringService.settleMeasuredFromEvidence).toHaveBeenCalledWith(
			"usage_event_marketing",
			1,
		);
		expect(
			meteringService.settleMeasuredFromEvidence.mock
				.invocationCallOrder[0] as number,
		).toBeLessThan(db.update.mock.invocationCallOrder[0] as number);
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ status: "succeeded" }),
		);
	});

	it("does not publish a recovered document when existing settlement fails", async () => {
		const { db, meteringService, service } = setup();
		const settlementError = new Error("settlement unavailable");
		meteringService.settleMeasuredFromEvidence.mockRejectedValueOnce(
			settlementError,
		);

		await expect(service.list(SCOPE, BASE_ROW.projectId)).rejects.toBe(
			settlementError,
		);
		expect(db.update).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("captures a stale failure only after winning the status CAS", async () => {
		const { db, service, updateSet } = setup();
		vi.mocked(getObjectContentType).mockResolvedValueOnce(null);

		await service.list(SCOPE, BASE_ROW.projectId);

		expect(aiErrorMocks.captureAiError).toHaveBeenCalledOnce();
		expect(db.update.mock.invocationCallOrder[0]).toBeLessThan(
			aiErrorMocks.captureAiError.mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
		expect(updateSet).toHaveBeenCalledWith({
			sentryEventId: "marketing-sentry-event",
		});

		const losing = setup();
		aiErrorMocks.captureAiError.mockClear();
		losing.updateReturning.mockReset().mockResolvedValue([]);
		vi.mocked(getObjectContentType).mockResolvedValueOnce(null);

		await losing.service.list(SCOPE, BASE_ROW.projectId);

		expect(aiErrorMocks.captureAiError).not.toHaveBeenCalled();
	});
});
