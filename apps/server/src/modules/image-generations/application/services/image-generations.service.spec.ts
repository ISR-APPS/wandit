import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getObjectContentType,
	imageGenerationKey,
	publicAssetUrl,
} from "../../../../infrastructure/storage/r2";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type {
	ImageGenerationAttemptRow,
	ImageGenerationsRepository,
} from "../../infrastructure/persistence/image-generations.repository";
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

const BASE_ROW: ImageGenerationAttemptRow = {
	aspect: "1:1",
	completedAt: null,
	count: 1,
	createdAt: new Date("2026-07-24T10:00:00.000Z"),
	error: null,
	id: "11111111-1111-4111-8111-111111111111",
	images: null,
	projectId: "22222222-2222-4222-8222-222222222222",
	prompt: "A product photo.",
	sourceImageUrls: [],
	status: "generating",
	title: "Product photo",
};

function setup() {
	const staleRow = { ...BASE_ROW };
	const succeededRow: ImageGenerationAttemptRow = {
		...staleRow,
		completedAt: new Date(),
		images: [
			{
				mediaType: "image/png",
				url: "https://assets.example.com/recovered.png",
			},
		],
		status: "succeeded",
	};
	const repository = {
		findOwnedAttempt: vi
			.fn()
			.mockResolvedValueOnce(staleRow)
			.mockResolvedValueOnce(succeededRow),
		markAttemptFailed: vi.fn(),
	};
	const usageEvent = {
		id: "usage_event_image",
		operation: "image",
	} as Awaited<ReturnType<MeteringService["reserve"]>>;
	const meteringService = {
		findByIdempotencyKey: vi.fn().mockResolvedValue(usageEvent),
		refund: vi.fn(),
		settleFixedFromEvidence: vi.fn().mockResolvedValue(usageEvent),
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
	const service = new ImageGenerationsService(
		repository as unknown as ImageGenerationsRepository,
		meteringService as unknown as MeteringService,
		db as never,
		analytics as never,
	);

	return { db, meteringService, repository, service, updateSet };
}

beforeEach(() => {
	vi.mocked(getObjectContentType).mockReset();
	vi.mocked(getObjectContentType).mockResolvedValue("image/png");
	vi.mocked(imageGenerationKey).mockClear();
	vi.mocked(publicAssetUrl).mockClear();
});

describe("ImageGenerationsService stale recovery billing", () => {
	it("settles an existing per-image hold before publishing recovered images", async () => {
		const { db, meteringService, service, updateSet } = setup();

		await expect(service.attempt("user_1", BASE_ROW.id)).resolves.toMatchObject(
			{
				id: BASE_ROW.id,
				status: "succeeded",
			},
		);
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			`image:${BASE_ROW.id}`,
			"user_1",
		);
		expect(meteringService.settleFixedFromEvidence).toHaveBeenCalledWith(
			"usage_event_image",
			1,
		);
		expect(
			meteringService.settleFixedFromEvidence.mock
				.invocationCallOrder[0] as number,
		).toBeLessThan(db.update.mock.invocationCallOrder[0] as number);
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ status: "succeeded" }),
		);
	});

	it("does not publish recovered images when existing settlement fails", async () => {
		const { db, meteringService, service } = setup();
		const settlementError = new Error("settlement unavailable");
		meteringService.settleFixedFromEvidence.mockRejectedValueOnce(
			settlementError,
		);

		await expect(service.attempt("user_1", BASE_ROW.id)).rejects.toBe(
			settlementError,
		);
		expect(db.update).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("publishes the durable partial prefix and settles against durable completion evidence", async () => {
		const { meteringService, repository, service, updateSet } = setup();
		const partialRow = { ...BASE_ROW, count: 4 };
		repository.findOwnedAttempt
			.mockReset()
			.mockResolvedValueOnce(partialRow)
			.mockResolvedValueOnce({
				...partialRow,
				completedAt: new Date(),
				images: [
					{
						mediaType: "image/png",
						url: "https://assets.example.com/recovered-1.png",
					},
				],
				status: "succeeded",
			});
		vi.mocked(getObjectContentType).mockImplementation(async (key) =>
			key.endsWith("img-1.png") ? "image/png" : null,
		);

		await expect(service.attempt("user_1", BASE_ROW.id)).resolves.toMatchObject(
			{
				images: [expect.objectContaining({ mediaType: "image/png" })],
				status: "succeeded",
			},
		);
		expect(meteringService.settleFixedFromEvidence).toHaveBeenCalledWith(
			"usage_event_image",
			1,
		);
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				images: [expect.objectContaining({ mediaType: "image/png" })],
				status: "succeeded",
			}),
		);
	});
});
