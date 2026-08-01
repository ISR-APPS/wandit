import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { Database } from "../../../../infrastructure/database/database.constants";
import type { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import type {
	ImageGenerationAttemptRow,
	ImageGenerationsRepository,
} from "../../infrastructure/persistence/image-generations.repository";
import type { ImageGenerationPlacementService } from "./image-generation-placement.service";
import { ImageGenerationsService } from "./image-generations.service";

const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";

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
		projectId: "22222222-2222-4222-8222-222222222222",
		prompt: "Editorial product image",
		sourceImageUrls: [],
		spec: null,
		status: "succeeded",
		title: "Product image",
		...overrides,
	};
}

describe("ImageGenerationsService attempt placement", () => {
	const findOwnedAttempt = vi.fn();
	const refundGenerationReservation = vi.fn();
	const settlePlacement = vi.fn();
	let service: ImageGenerationsService;

	beforeEach(() => {
		vi.clearAllMocks();
		settlePlacement.mockResolvedValue(false);
		service = new ImageGenerationsService(
			{ findOwnedAttempt } as unknown as ImageGenerationsRepository,
			{
				settle: settlePlacement,
			} as unknown as ImageGenerationPlacementService,
			{
				refundGenerationReservation,
			} as unknown as GenerationPolicyService,
			{} as Database,
			{} as AnalyticsService,
		);
	});

	it.each([
		"applied",
		"failed",
	] as const)("exposes only a %s placement status", async (status) => {
		findOwnedAttempt.mockResolvedValue(
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

		const attempt = await service.attempt("user-1", ATTEMPT_ID);

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
		findOwnedAttempt
			.mockResolvedValueOnce(pending)
			.mockResolvedValueOnce(applied);
		settlePlacement.mockResolvedValueOnce(true);

		const attempt = await service.attempt("user-1", ATTEMPT_ID);

		expect(settlePlacement).toHaveBeenCalledWith(pending, pending.images);
		expect(findOwnedAttempt).toHaveBeenCalledTimes(2);
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
		const recovered = attemptRow({
			spec: generating.spec,
		});
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
		findOwnedAttempt
			.mockResolvedValueOnce(generating)
			.mockResolvedValueOnce(recovered)
			.mockResolvedValueOnce(applied);
		const staleSettlement = vi
			.spyOn(
				service as unknown as {
					settleStaleGenerating: (
						row: ImageGenerationAttemptRow,
						cutoff: Date,
						userId: string,
					) => Promise<boolean>;
				},
				"settleStaleGenerating",
			)
			.mockResolvedValue(true);
		settlePlacement.mockResolvedValueOnce(true);

		const attempt = await service.attempt("user-1", ATTEMPT_ID);

		expect(staleSettlement).toHaveBeenCalledWith(
			generating,
			expect.any(Date),
			"user-1",
		);
		expect(settlePlacement).toHaveBeenCalledWith(recovered, recovered.images);
		expect(findOwnedAttempt).toHaveBeenCalledTimes(3);
		expect(attempt.placement).toEqual({ status: "applied" });
	});

	it("derives failed placement when generation fails before placement runs", async () => {
		findOwnedAttempt.mockResolvedValue(
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

		const attempt = await service.attempt("user-1", ATTEMPT_ID);

		expect(attempt.placement).toEqual({ status: "failed" });
		expect(refundGenerationReservation).toHaveBeenCalledWith(
			"user-1",
			ATTEMPT_ID,
		);
	});

	it("omits placement for standalone attempts", async () => {
		findOwnedAttempt.mockResolvedValue(attemptRow());

		const attempt = await service.attempt("user-1", ATTEMPT_ID);

		expect(attempt.placement).toBeUndefined();
	});
});
