import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	getObjectBytes,
	getObjectContentType,
	imageGenerationKey,
	publicAssetKeyFromUrl,
	publicAssetUrl,
} from "../../../../infrastructure/storage/r2";
import type { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	ImageGenerationAttemptRow,
	ImageGenerationsRepository,
} from "../../infrastructure/persistence/image-generations.repository";
import type { ImageGenerationPlacementService } from "./image-generation-placement.service";
import { ImageGenerationsService } from "./image-generations.service";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	getObjectBytes: vi.fn(),
	getObjectContentType: vi.fn(),
	imageGenerationKey: vi.fn(
		(projectId: string, attemptId: string, index: number, extension: string) =>
			`sites/${projectId}/assets/${attemptId}/img-${index}.${extension}`,
	),
	publicAssetKeyFromUrl: vi.fn(),
	publicAssetUrl: vi.fn((key: string) => `https://assets.example.com/${key}`),
}));

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const SCOPE: ProjectScope = { kind: "personal", userId: "user_1" };
const PLACEMENT_SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };

function attemptRow(
	overrides: Partial<ImageGenerationAttemptRow> = {},
): ImageGenerationAttemptRow {
	return {
		aspect: "1:1",
		completedAt: new Date("2026-08-01T10:01:00.000Z"),
		count: 1,
		createdAt: new Date("2026-08-01T10:00:00.000Z"),
		error: null,
		id: ATTEMPT_ID,
		images: [
			{
				mediaType: "image/png",
				url: "https://assets.example.com/images/result.png",
			},
		],
		projectId: PROJECT_ID,
		prompt: "Editorial product image",
		sourceImageUrls: [],
		spec: null,
		status: "succeeded",
		title: "Product image",
		...overrides,
	};
}

const STALE_ROW = attemptRow({
	completedAt: null,
	createdAt: new Date("2026-07-24T10:00:00.000Z"),
	images: null,
	prompt: "A product photo.",
	status: "generating",
	title: "Product photo",
});

function setupStaleRecovery(
	options: {
		hasUsageEvent?: boolean;
		staleRow?: Partial<ImageGenerationAttemptRow>;
		usageActorUserId?: string;
	} = {},
) {
	const staleRow = { ...STALE_ROW, ...options.staleRow };
	const succeededRow = attemptRow({
		...staleRow,
		completedAt: new Date(),
		images: [
			{
				mediaType: "image/png",
				url: "https://assets.example.com/recovered.png",
			},
		],
		status: "succeeded",
	});
	const repository = {
		findAccessibleAttempt: vi
			.fn()
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(succeededRow),
		markAttemptFailed: vi.fn(),
	};
	const usageEvent = {
		id: "usage_event_image",
		operation: "image",
		status: "reserved",
		userId: options.usageActorUserId ?? "user_1",
	} as Awaited<ReturnType<MeteringService["reserve"]>>;
	const meteringService = {
		findByIdempotencyKey: vi
			.fn()
			.mockResolvedValue(options.hasUsageEvent === false ? null : usageEvent),
		refund: vi.fn(),
		settleMeasuredFromEvidence: vi.fn().mockResolvedValue(usageEvent),
	};
	const settlePlacement = vi.fn().mockResolvedValue(false);
	const selectLimit = vi
		.fn()
		.mockResolvedValue([{ startedAt: new Date(Date.now() - 20 * 60 * 1_000) }]);
	const updateReturning = vi
		.fn()
		.mockResolvedValue([{ projectId: PROJECT_ID }]);
	const updateSet = vi.fn(() => ({
		where: vi.fn(() => ({ returning: updateReturning })),
	}));
	const update = vi.fn(() => ({ set: updateSet }));
	const tx = { update };
	const transaction = vi.fn(
		async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
	);
	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit: selectLimit })),
			})),
		})),
		transaction,
		update,
	};
	const analytics = { capture: vi.fn() };
	const lifecycleEventsService = { enqueue: vi.fn().mockResolvedValue(null) };
	const service = new ImageGenerationsService(
		repository as unknown as ImageGenerationsRepository,
		{ settle: settlePlacement } as unknown as ImageGenerationPlacementService,
		meteringService as unknown as MeteringService,
		db as unknown as Database,
		analytics as unknown as AnalyticsService,
		lifecycleEventsService as unknown as LifecycleEventsService,
	);

	return {
		db,
		meteringService,
		analytics,
		lifecycleEventsService,
		repository,
		service,
		settlePlacement,
		tx,
		updateSet,
		usageEvent,
	};
}

beforeEach(() => {
	vi.mocked(getObjectBytes).mockReset();
	vi.mocked(getObjectContentType).mockReset();
	vi.mocked(getObjectContentType).mockResolvedValue("image/png");
	vi.mocked(imageGenerationKey).mockClear();
	vi.mocked(publicAssetKeyFromUrl).mockReset();
	vi.mocked(publicAssetUrl).mockClear();
});

describe("ImageGenerationsService stale recovery billing", () => {
	it("settles an existing per-image hold before publishing recovered images", async () => {
		const {
			db,
			lifecycleEventsService,
			meteringService,
			service,
			tx,
			updateSet,
		} = setupStaleRecovery();

		await expect(service.attempt(SCOPE, STALE_ROW.id)).resolves.toMatchObject({
			id: STALE_ROW.id,
			status: "succeeded",
		});
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			`image:${STALE_ROW.id}`,
			{ actorUserId: "user_1" },
		);
		expect(meteringService.settleMeasuredFromEvidence).toHaveBeenCalledWith(
			"usage_event_image",
			1,
		);
		expect(
			meteringService.settleMeasuredFromEvidence.mock
				.invocationCallOrder[0] as number,
		).toBeLessThan(db.update.mock.invocationCallOrder[0] as number);
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ status: "succeeded" }),
		);
		expect(lifecycleEventsService.enqueue).toHaveBeenCalledWith(
			{
				event: "image_generated",
				idempotencyKey: "image_generated:user_1",
				userId: "user_1",
			},
			tx,
		);
	});

	it("uses the persisted queue actor instead of a different polling org member", async () => {
		const { lifecycleEventsService, meteringService, service } =
			setupStaleRecovery({
				staleRow: { spec: { actorUserId: "queue_actor_1" } },
			});
		const scope: ProjectScope = {
			actorIsLimitExempt: false,
			kind: "org",
			organizationId: "org_1",
			userId: "polling_member_2",
		};

		await expect(service.attempt(scope, STALE_ROW.id)).resolves.toMatchObject({
			status: "succeeded",
		});
		expect(lifecycleEventsService.enqueue).toHaveBeenCalledWith(
			expect.objectContaining({
				idempotencyKey: "image_generated:queue_actor_1",
				userId: "queue_actor_1",
			}),
			expect.anything(),
		);
		// Only the billing settlement lookup runs; actor resolution uses the row.
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledOnce();
	});

	it("uses the usage-event actor for a legacy metered org attempt", async () => {
		const { lifecycleEventsService, meteringService, service } =
			setupStaleRecovery({ usageActorUserId: "legacy_queue_actor_1" });
		const scope: ProjectScope = {
			actorIsLimitExempt: false,
			kind: "org",
			organizationId: "org_1",
			userId: "polling_member_2",
		};

		await expect(service.attempt(scope, STALE_ROW.id)).resolves.toMatchObject({
			status: "succeeded",
		});
		expect(lifecycleEventsService.enqueue).toHaveBeenCalledWith(
			expect.objectContaining({
				idempotencyKey: "image_generated:legacy_queue_actor_1",
				userId: "legacy_queue_actor_1",
			}),
			expect.anything(),
		);
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledTimes(2);
	});

	it("does not misattribute a legacy billing-off org recovery", async () => {
		const { analytics, db, lifecycleEventsService, service, updateSet } =
			setupStaleRecovery({ hasUsageEvent: false });
		const scope: ProjectScope = {
			actorIsLimitExempt: false,
			kind: "org",
			organizationId: "org_1",
			userId: "polling_member_2",
		};

		await expect(service.attempt(scope, STALE_ROW.id)).resolves.toMatchObject({
			status: "succeeded",
		});
		expect(db.transaction).toHaveBeenCalledOnce();
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ status: "succeeded" }),
		);
		expect(lifecycleEventsService.enqueue).not.toHaveBeenCalled();
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("uses the personal scope as the safe legacy billing-off fallback", async () => {
		const { lifecycleEventsService, service } = setupStaleRecovery({
			hasUsageEvent: false,
		});

		await expect(service.attempt(SCOPE, STALE_ROW.id)).resolves.toMatchObject({
			status: "succeeded",
		});
		expect(lifecycleEventsService.enqueue).toHaveBeenCalledWith(
			expect.objectContaining({
				idempotencyKey: "image_generated:user_1",
				userId: "user_1",
			}),
			expect.anything(),
		);
	});

	it("propagates lifecycle persistence failure before recovered success commits", async () => {
		const { analytics, lifecycleEventsService, service } = setupStaleRecovery();
		const lifecycleError = new Error("lifecycle persistence unavailable");
		lifecycleEventsService.enqueue.mockRejectedValueOnce(lifecycleError);

		await expect(service.attempt(SCOPE, STALE_ROW.id)).rejects.toBe(
			lifecycleError,
		);
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("does not publish recovered images when existing settlement fails", async () => {
		const { db, meteringService, service } = setupStaleRecovery();
		const settlementError = new Error("settlement unavailable");
		meteringService.settleMeasuredFromEvidence.mockRejectedValueOnce(
			settlementError,
		);

		await expect(service.attempt(SCOPE, STALE_ROW.id)).rejects.toBe(
			settlementError,
		);
		expect(db.update).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("publishes the durable sparse subset and settles against durable completion evidence", async () => {
		const { meteringService, repository, service, updateSet } =
			setupStaleRecovery();
		const partialRow = { ...STALE_ROW, count: 4 };
		repository.findAccessibleAttempt
			.mockReset()
			.mockResolvedValueOnce(partialRow)
			.mockResolvedValueOnce(
				attemptRow({
					...partialRow,
					completedAt: new Date(),
					images: [
						{
							index: 1,
							mediaType: "image/png",
							url: "https://assets.example.com/recovered-1.png",
						},
						{
							index: 3,
							mediaType: "image/png",
							url: "https://assets.example.com/recovered-3.png",
						},
					],
					status: "succeeded",
				}),
			);
		vi.mocked(getObjectContentType).mockImplementation(async (key) =>
			key.endsWith("img-1.png") || key.endsWith("img-3.png")
				? "image/png"
				: null,
		);

		await expect(service.attempt(SCOPE, STALE_ROW.id)).resolves.toMatchObject({
			images: [
				expect.objectContaining({ index: 1, mediaType: "image/png" }),
				expect.objectContaining({ index: 3, mediaType: "image/png" }),
			],
			status: "succeeded",
		});
		expect(meteringService.settleMeasuredFromEvidence).toHaveBeenCalledWith(
			"usage_event_image",
			2,
		);
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				images: [
					expect.objectContaining({ index: 1, mediaType: "image/png" }),
					expect.objectContaining({ index: 3, mediaType: "image/png" }),
				],
				status: "succeeded",
			}),
		);
	});
});

describe("ImageGenerationsService download", () => {
	it("resolves an original generation index from a sparse successful subset", async () => {
		const thirdUrl = "https://assets.example.com/images/result-3.png";
		const repository = {
			findAccessibleAttempt: vi.fn().mockResolvedValue(
				attemptRow({
					count: 4,
					images: [
						{
							index: 1,
							mediaType: "image/png",
							url: "https://assets.example.com/images/result-1.png",
						},
						{ index: 3, mediaType: "image/png", url: thirdUrl },
					],
				}),
			),
		};
		const service = new ImageGenerationsService(
			repository as unknown as ImageGenerationsRepository,
			{} as ImageGenerationPlacementService,
			{} as MeteringService,
			{} as Database,
			{} as AnalyticsService,
			{} as LifecycleEventsService,
		);
		vi.mocked(publicAssetKeyFromUrl).mockReturnValueOnce(
			"images/project/result-3.png",
		);
		vi.mocked(getObjectBytes).mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

		await expect(service.download(SCOPE, ATTEMPT_ID, 3)).resolves.toEqual({
			bytes: new Uint8Array([1, 2, 3]),
			fileName: "product-image-3.png",
			mediaType: "image/png",
		});
		expect(publicAssetKeyFromUrl).toHaveBeenCalledWith(thirdUrl);
	});

	it("does not fall back positionally when an indexed slot is missing", async () => {
		const repository = {
			findAccessibleAttempt: vi.fn().mockResolvedValue(
				attemptRow({
					count: 4,
					images: [
						{
							index: 2,
							mediaType: "image/png",
							url: "https://assets.example.com/images/result-2.png",
						},
						{
							index: 3,
							mediaType: "image/png",
							url: "https://assets.example.com/images/result-3.png",
						},
					],
				}),
			),
		};
		const service = new ImageGenerationsService(
			repository as unknown as ImageGenerationsRepository,
			{} as ImageGenerationPlacementService,
			{} as MeteringService,
			{} as Database,
			{} as AnalyticsService,
			{} as LifecycleEventsService,
		);

		await expect(service.download(SCOPE, ATTEMPT_ID, 1)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(publicAssetKeyFromUrl).not.toHaveBeenCalled();
	});
});

describe("ImageGenerationsService attempt placement", () => {
	const findAccessibleAttempt = vi.fn();
	const findByIdempotencyKey = vi.fn();
	const refund = vi.fn();
	const settlePlacement = vi.fn();
	let service: ImageGenerationsService;

	beforeEach(() => {
		vi.clearAllMocks();
		findByIdempotencyKey.mockResolvedValue(null);
		settlePlacement.mockResolvedValue(false);
		service = new ImageGenerationsService(
			{ findAccessibleAttempt } as unknown as ImageGenerationsRepository,
			{
				settle: settlePlacement,
			} as unknown as ImageGenerationPlacementService,
			{
				findByIdempotencyKey,
				refund,
			} as unknown as MeteringService,
			{} as Database,
			{} as AnalyticsService,
			{} as LifecycleEventsService,
		);
	});

	it.each([
		"applied",
		"failed",
	] as const)("exposes only a %s placement status", async (status) => {
		findAccessibleAttempt.mockResolvedValue(
			attemptRow({
				spec: {
					placement: {
						imageIndex: 1,
						kind: "image-src",
						status,
						wid: "hero-image",
					},
				},
			}),
		);

		const attempt = await service.attempt(PLACEMENT_SCOPE, ATTEMPT_ID);

		expect(attempt.placement).toEqual({ status });
	});

	it("repairs a succeeded pending placement while the client polls", async () => {
		const pending = attemptRow({
			spec: {
				placement: {
					imageIndex: 1,
					kind: "image-src",
					status: "pending",
					wid: "e-3",
				},
			},
		});
		const applied = attemptRow({
			spec: {
				placement: {
					imageIndex: 1,
					kind: "image-src",
					status: "applied",
					versionNumber: 4,
					wid: "e-3",
				},
			},
		});
		findAccessibleAttempt
			.mockResolvedValueOnce(pending)
			.mockResolvedValueOnce(applied);
		settlePlacement.mockResolvedValueOnce(true);

		const attempt = await service.attempt(PLACEMENT_SCOPE, ATTEMPT_ID);

		expect(settlePlacement).toHaveBeenCalledWith(pending, pending.images);
		expect(findAccessibleAttempt).toHaveBeenCalledTimes(2);
		expect(attempt.placement).toEqual({ status: "applied" });
	});

	it("repairs placement after poll-time stale generation recovery", async () => {
		const generating = attemptRow({
			completedAt: null,
			images: null,
			spec: {
				placement: {
					imageIndex: 1,
					kind: "image-src",
					status: "pending",
					wid: "e-3",
				},
			},
			status: "generating",
		});
		const recovered = attemptRow({ spec: generating.spec });
		const applied = attemptRow({
			spec: {
				placement: {
					imageIndex: 1,
					kind: "image-src",
					status: "applied",
					versionNumber: 5,
					wid: "e-3",
				},
			},
		});
		findAccessibleAttempt
			.mockResolvedValueOnce(generating)
			.mockResolvedValueOnce(recovered)
			.mockResolvedValueOnce(applied);
		const staleSettlement = vi
			.spyOn(
				service as unknown as {
					settleStaleGenerating: (
						row: ImageGenerationAttemptRow,
						cutoff: Date,
						scope: ProjectScope,
					) => Promise<boolean>;
				},
				"settleStaleGenerating",
			)
			.mockResolvedValue(true);
		settlePlacement.mockResolvedValueOnce(true);

		const attempt = await service.attempt(PLACEMENT_SCOPE, ATTEMPT_ID);

		expect(staleSettlement).toHaveBeenCalledWith(
			generating,
			expect.any(Date),
			PLACEMENT_SCOPE,
		);
		expect(settlePlacement).toHaveBeenCalledWith(recovered, recovered.images);
		expect(findAccessibleAttempt).toHaveBeenCalledTimes(3);
		expect(attempt.placement).toEqual({ status: "applied" });
	});

	it("derives failed placement and refunds through metering", async () => {
		findAccessibleAttempt.mockResolvedValue(
			attemptRow({
				error: "Provider failed",
				images: null,
				spec: {
					placement: {
						imageIndex: 1,
						kind: "image-src",
						status: "pending",
						wid: "hero-image",
					},
				},
				status: "failed",
			}),
		);
		findByIdempotencyKey.mockResolvedValueOnce({
			id: "usage_event_image",
			operation: "image",
			status: "reserved",
		});

		const attempt = await service.attempt(PLACEMENT_SCOPE, ATTEMPT_ID);

		expect(attempt.placement).toEqual({ status: "failed" });
		expect(findByIdempotencyKey).toHaveBeenCalledWith(`image:${ATTEMPT_ID}`, {
			actorUserId: "user-1",
		});
		expect(refund).toHaveBeenCalledWith(
			"usage_event_image",
			"image_generation_failed",
		);
	});

	it("omits placement for standalone attempts", async () => {
		findAccessibleAttempt.mockResolvedValue(attemptRow());

		const attempt = await service.attempt(PLACEMENT_SCOPE, ATTEMPT_ID);

		expect(attempt.placement).toBeUndefined();
	});
});
