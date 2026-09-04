import { describe, expect, it, vi } from "vitest";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import { createImageGenerationBilling } from "./image-generation-billing";

const MEASURED_SNAPSHOT = {
	estimatedUnitUsdMicros: 134_400,
	mode: "measured",
	operation: "image",
	reserveFloorCredits: 100,
	source: "operation_registry_reservation",
	unit: "image",
	units: 4,
	usdMicrosPerCredit: 40_000,
};

function meteringServiceDouble(
	event: Record<string, unknown>,
	estimate: { costUsdMicros: number; unitUsdMicros: number } | null,
) {
	return {
		captureGeneration: vi.fn().mockResolvedValue(null),
		estimateMeasuredCost: vi.fn().mockResolvedValue(estimate),
		findByIdempotencyKey: vi.fn().mockResolvedValue(null),
		refund: vi.fn().mockResolvedValue(event),
		reserveWithReplay: vi.fn().mockResolvedValue({
			event,
			replay: "none",
			replayed: false,
		}),
		settle: vi.fn().mockResolvedValue(event),
		settleMeasuredFromEvidence: vi.fn().mockResolvedValue(event),
		usdMicrosPerCredit: 40_000,
	};
}

describe("createImageGenerationBilling", () => {
	it("reserves the catalog estimate for the requested count and settles it", async () => {
		const event = {
			id: "event_1",
			operation: "image",
			pricingSnapshot: MEASURED_SNAPSHOT,
			reservedCredits: 1344,
		} as unknown as Awaited<ReturnType<MeteringService["reserve"]>>;
		const meteringService = meteringServiceDouble(event, {
			costUsdMicros: 537_600,
			unitUsdMicros: 134_400,
		});
		const billing = createImageGenerationBilling({
			isBillingDisabled: () => false,
			meteringService,
		});

		const reservation = await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			4,
			"parent_1",
		);
		await billing.settle(reservation);

		expect(meteringService.estimateMeasuredCost).toHaveBeenCalledWith(
			expect.objectContaining({ count: 4, kind: "image" }),
		);
		// 4 × $0.1344 = $0.5376 → 1,344 cc, above the 4 × 100 cc floor.
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			{
				attemptRef: "attempt_1",
				credits: 1344,
				estimatedCostUsdMicros: 537_600,
				idempotencyKey: "image:attempt_1",
				measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 4 },
				parentEventId: "parent_1",
			},
		);
		expect(meteringService.settle).toHaveBeenCalledWith("event_1", {
			costUsdMicros: 537_600,
			finalCredits: 1344,
			pricing: "direct",
			pricingSnapshot: {
				estimatedUnitUsdMicros: 134_400,
				mode: "measured",
				operation: "image",
				outcome: "delivered",
				source: "measured_local",
				unit: "image",
				units: 4,
				usdMicrosPerCredit: 40_000,
			},
		});
	});

	it("reserves the floor when the model has no catalog rate", async () => {
		const event = {
			id: "event_floor",
			operation: "image",
			pricingSnapshot: { ...MEASURED_SNAPSHOT, estimatedUnitUsdMicros: null },
			reservedCredits: 400,
		} as unknown as Awaited<ReturnType<MeteringService["reserve"]>>;
		const meteringService = meteringServiceDouble(event, null);
		const billing = createImageGenerationBilling({
			isBillingDisabled: () => false,
			meteringService,
		});

		const reservation = await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			4,
		);
		await billing.settle(reservation, 0);

		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			expect.objectContaining({ credits: 400, estimatedCostUsdMicros: null }),
		);
		expect(meteringService.settle).toHaveBeenCalledWith(
			"event_floor",
			expect.objectContaining({
				costUsdMicros: null,
				finalCredits: 0,
				pricingSnapshot: expect.objectContaining({
					outcome: "failed_no_deliverable",
					units: 0,
				}),
			}),
		);
	});

	it("settles partial output at the reservation-time unit price after registry drift", async () => {
		const event = { id: "event_old_price", reservedCredits: 1600 } as Awaited<
			ReturnType<MeteringService["reserve"]>
		>;
		const meteringService = meteringServiceDouble(event, null);
		const billing = createImageGenerationBilling({
			isBillingDisabled: () => false,
			meteringService,
		});
		const oldPriceReservation = {
			credits: 1600,
			eventId: "event_old_price",
			operation: "image" as const,
			referenceId: "attempt_old_price",
			replay: "none" as const,
			terms: { creditsPerUnit: 400, mode: "fixed" as const, unit: "image" },
			units: 4,
		};

		await billing.settle(oldPriceReservation, 1);

		expect(meteringService.settle).toHaveBeenCalledWith(
			"event_old_price",
			expect.objectContaining({
				finalCredits: 400,
				pricingSnapshot: expect.objectContaining({
					creditsPerUnit: 400,
					units: 1,
				}),
			}),
		);
	});
});
