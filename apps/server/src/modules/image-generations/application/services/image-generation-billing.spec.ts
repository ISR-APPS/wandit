import { describe, expect, it, vi } from "vitest";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import { createImageGenerationBilling } from "./image-generation-billing";

describe("createImageGenerationBilling", () => {
	it("prices the requested image count at five credits per image", async () => {
		const event = { id: "event_1", reservedCredits: 20 } as Awaited<
			ReturnType<MeteringService["reserve"]>
		>;
		const meteringService = {
			captureGeneration: vi.fn().mockResolvedValue(null),
			findByIdempotencyKey: vi.fn().mockResolvedValue(event),
			refund: vi.fn().mockResolvedValue(event),
			reserveWithReplay: vi.fn().mockResolvedValue({
				event,
				replay: "none",
				replayed: false,
			}),
			settle: vi.fn().mockResolvedValue(event),
			settleFixedFromEvidence: vi.fn().mockResolvedValue(event),
		};
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

		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			{
				attemptRef: "attempt_1",
				credits: 20,
				idempotencyKey: "image:attempt_1",
				parentEventId: "parent_1",
			},
		);
		expect(meteringService.settle).toHaveBeenCalledWith("event_1", {
			finalCredits: 20,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerUnit: 5,
				mode: "fixed",
				operation: "image",
				source: "operation_registry",
				unit: "image",
				units: 4,
			},
		});
	});

	it("settles partial output at the reservation-time unit price after registry drift", async () => {
		const event = { id: "event_old_price", reservedCredits: 16 } as Awaited<
			ReturnType<MeteringService["reserve"]>
		>;
		const meteringService = {
			captureGeneration: vi.fn().mockResolvedValue(null),
			findByIdempotencyKey: vi.fn().mockResolvedValue(event),
			refund: vi.fn().mockResolvedValue(event),
			reserveWithReplay: vi.fn(),
			settle: vi.fn().mockResolvedValue(event),
			settleFixedFromEvidence: vi.fn().mockResolvedValue(event),
		};
		const billing = createImageGenerationBilling({
			isBillingDisabled: () => false,
			meteringService,
		});
		const oldPriceReservation = {
			credits: 16,
			eventId: "event_old_price",
			operation: "image" as const,
			referenceId: "attempt_old_price",
			replay: "none" as const,
			units: 4,
		};

		await billing.settle(oldPriceReservation, 1);

		expect(meteringService.settle).toHaveBeenCalledWith(
			"event_old_price",
			expect.objectContaining({
				finalCredits: 4,
				pricingSnapshot: expect.objectContaining({
					creditsPerUnit: 4,
					units: 1,
				}),
			}),
		);
	});
});
