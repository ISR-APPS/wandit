import { describe, expect, it, vi } from "vitest";

import type { AiUsageEvent } from "../../domain/metering";
import {
	createMeasuredOperationBilling,
	type MeasuredOperationReservation,
	measuredDirectSettlement,
	measuredOperationSettlement,
	measuredReserveCredits,
	reservationTermsFromEvent,
} from "./fixed-operation-billing";

const LEGACY_FIXED_SNAPSHOT = {
	creditsPerUnit: 4,
	mode: "fixed",
	operation: "image",
	reserveFloorCredits: 5,
	source: "operation_registry_reservation",
	unit: "image",
	usdMicrosPerCredit: 50_000,
};

const MEASURED_SNAPSHOT = {
	estimatedUnitUsdMicros: 134_400,
	mode: "measured",
	operation: "image",
	reserveFloorCredits: 350,
	source: "operation_registry_reservation",
	unit: "image",
	units: 2,
	usdMicrosPerCredit: 40_000,
};

function usageEvent(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
	return {
		attemptRef: "attempt_1",
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: null,
		createdAt: new Date("2026-08-01T00:00:00.000Z"),
		estimatedCostUsdMicros: null,
		finalCredits: null,
		id: "11111111-1111-4111-8111-111111111111",
		idempotencyKey: "image:attempt_1",
		inputTokens: null,
		messageId: null,
		model: null,
		operation: "image",
		organizationId: null,
		outputTokens: null,
		parentEventId: null,
		pricingSnapshot: LEGACY_FIXED_SNAPSHOT,
		provider: null,
		rawUsage: null,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: 16,
		settledAt: null,
		status: "reserved",
		userId: "user_1",
		executionLeaseToken: null,
		executionLeaseExpiresAt: null,
		reconcileAttempts: 0,
		nextReconcileAttemptAt: null,
		...overrides,
	};
}

function setup(
	event: AiUsageEvent | null,
	options: { insertedEvent?: AiUsageEvent } = {},
) {
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue({ id: "ref_1" }),
		findByIdempotencyKey: vi.fn().mockResolvedValue(event),
		refund: vi.fn().mockResolvedValue(event),
		reserveWithReplay: vi
			.fn()
			.mockImplementation(async () =>
				event
					? { event, replay: event.status, replayed: true }
					: { event: options.insertedEvent, replay: "none", replayed: false },
			),
		settle: vi.fn().mockResolvedValue(event),
		settleMeasuredFromEvidence: vi.fn().mockResolvedValue(event),
		usdMicrosPerCredit: 40_000,
	};
	const billing = createMeasuredOperationBilling("image", {
		isBillingDisabled: () => false,
		meteringService,
	});

	return { billing, meteringService };
}

function measuredReservation(
	overrides: Partial<MeasuredOperationReservation> = {},
): MeasuredOperationReservation {
	return {
		credits: 672,
		eventId: "event_1",
		operation: "image",
		referenceId: "attempt_1",
		replay: "none",
		terms: {
			estimatedUnitUsdMicros: 134_400,
			mode: "measured",
			unit: "image",
			usdMicrosPerCredit: 40_000,
		},
		units: 2,
		...overrides,
	};
}

describe("createMeasuredOperationBilling", () => {
	it("reserves the larger of the floor and the local cost estimate", () => {
		// 2 × $0.1344 = $0.2688 → 840 cc at $0.032; beats the 2 × 100 cc floor.
		expect(measuredReserveCredits("image", 2, 268_800)).toBe(840);
		// 4K: $0.24 → 750 cc beats the 100 cc floor.
		expect(measuredReserveCredits("image", 1, 240_000)).toBe(750);
		expect(measuredReserveCredits("image", 3, null)).toBe(300);
		expect(measuredReserveCredits("video", 1, 1_050_000)).toBe(3282);
		expect(measuredReserveCredits("connector", 1, 0)).toBe(1);
		expect(measuredReserveCredits("image", 1, 0, 40_000, 1)).toBe(1);
	});

	it("writes measured terms and the estimate into a new reservation", async () => {
		const inserted = usageEvent({
			estimatedCostUsdMicros: 240_000,
			pricingSnapshot: {
				...MEASURED_SNAPSHOT,
				estimatedUnitUsdMicros: 240_000,
				units: 1,
			},
			reservedCredits: 600,
		});
		const { billing, meteringService } = setup(null, {
			insertedEvent: inserted,
		});

		const reservation = await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			{ estimateUsdMicros: 240_000, units: 1 },
		);

		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			{
				attemptRef: "attempt_1",
				credits: 600,
				estimatedCostUsdMicros: 240_000,
				idempotencyKey: "image:attempt_1",
				measuredTerms: { estimatedUnitUsdMicros: 240_000, units: 1 },
				parentEventId: undefined,
			},
		);
		expect(reservation).toMatchObject({
			credits: 600,
			replay: "none",
			terms: {
				estimatedUnitUsdMicros: 240_000,
				mode: "measured",
				usdMicrosPerCredit: 40_000,
			},
		});
	});

	it("replays a measured reservation with its durable terms, not a fresh quote", async () => {
		const event = usageEvent({
			estimatedCostUsdMicros: 268_800,
			pricingSnapshot: MEASURED_SNAPSHOT,
			reservedCredits: 700,
		});
		const { billing, meteringService } = setup(event);

		const reservation = await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			{ estimateUsdMicros: 999_999, units: 2 },
		);

		expect(reservation).toMatchObject({
			credits: 700,
			replay: "reserved",
			terms: { estimatedUnitUsdMicros: 134_400, mode: "measured" },
		});
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			expect.objectContaining({
				credits: 700,
				estimatedCostUsdMicros: 268_800,
				measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 2 },
			}),
		);
	});

	it.each([
		{ completedUnits: 3, label: "a partial batch" },
		{ completedUnits: 0, label: "a zero-unit failure" },
	])("replays a measured event settled at $label against reservation-time terms", async ({
		completedUnits,
	}) => {
		// Reviewer scenario: count=4, the provider returns `completedUnits`,
		// completePartialOrFailure settles, then the worker crashes before
		// markSucceeded. The settled snapshot carries the COMPLETED units; the
		// replay must not compare them with the 4 requested units.
		const settlement = measuredDirectSettlement(
			measuredReservation({ credits: 1_400, units: 4 }),
			{ completedUnits },
		);
		const event = usageEvent({
			estimatedCostUsdMicros: 537_600,
			finalCredits: settlement.finalCredits,
			pricingSnapshot: settlement.pricingSnapshot,
			reservedCredits: 1_400,
			settledAt: new Date("2026-08-01T00:05:00.000Z"),
			status: "settled",
		});
		const { billing, meteringService } = setup(event);

		await expect(
			billing.reserve({ actorUserId: "user_1" }, "attempt_1", {
				estimateUsdMicros: 537_600,
				units: 4,
			}),
		).resolves.toMatchObject({
			credits: 1_400,
			eventId: event.id,
			replay: "settled",
			terms: { estimatedUnitUsdMicros: 134_400, mode: "measured" },
			units: 4,
		});
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			expect.objectContaining({
				credits: 1_400,
				measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 4 },
			}),
		);
	});

	it("still rejects a replay whose requested units differ from the reservation", async () => {
		const event = usageEvent({
			estimatedCostUsdMicros: 268_800,
			pricingSnapshot: MEASURED_SNAPSHOT,
			reservedCredits: 700,
		});
		const { billing } = setup(event);

		await expect(
			billing.reserve({ actorUserId: "user_1" }, "attempt_1", { units: 3 }),
		).rejects.toThrow("measured replay is invalid");
	});

	it("prefers the nested reservation snapshot of a reconciled-from-reserved row", async () => {
		const event = usageEvent({
			finalCredits: 600,
			pricingSnapshot: {
				finalCredits: 600,
				gatewayReconciliation: {},
				mode: "measured",
				operation: "image",
				reservationPricingSnapshot: MEASURED_SNAPSHOT,
				source: "operation_registry_recovery",
				units: 1,
			},
			reconciledAt: new Date("2026-08-01T00:10:00.000Z"),
			reservedCredits: 700,
			status: "reconciled",
		});
		const { billing } = setup(event);

		await expect(
			billing.reserve({ actorUserId: "user_1" }, "attempt_1", { units: 2 }),
		).resolves.toMatchObject({ replay: "reconciled", units: 2 });
	});

	it("replays a legacy fixed reservation with its pre-deploy unit price", async () => {
		const event = usageEvent();
		const { billing, meteringService } = setup(event);

		const reservation = await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			{ estimateUsdMicros: 500_000, units: 4 },
		);

		expect(reservation).toMatchObject({
			credits: 16,
			replay: "reserved",
			terms: { creditsPerUnit: 4, mode: "fixed", unit: "image" },
		});
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			expect.objectContaining({ credits: 16, estimatedCostUsdMicros: null }),
		);
	});

	it("validates reconcile-failed replay against durable pricing after drift", async () => {
		const event = usageEvent({
			reconciledAt: new Date("2026-08-01T00:01:00.000Z"),
			status: "reconcile_failed",
		});
		const { billing, meteringService } = setup(event);

		await expect(
			billing.reserve({ actorUserId: "user_1" }, "attempt_1", { units: 4 }),
		).resolves.toMatchObject({
			credits: 16,
			eventId: event.id,
			replay: "reconcile_failed",
			terms: { creditsPerUnit: 4, mode: "fixed" },
		});
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("settles stored output through the atomic evidence API", async () => {
		const event = usageEvent();
		const { billing, meteringService } = setup(event);

		await expect(
			billing.settleExisting({ actorUserId: "user_1" }, "attempt_1", 3),
		).resolves.toBe(true);
		expect(meteringService.settleMeasuredFromEvidence).toHaveBeenCalledWith(
			event.id,
			3,
		);
	});

	it("does not reprice a financially finalized reconcile-failed event", async () => {
		const event = usageEvent({
			finalCredits: 4,
			reconciledAt: new Date("2026-08-01T00:01:00.000Z"),
			settledAt: new Date("2026-08-01T00:00:30.000Z"),
			status: "reconcile_failed",
		});
		const { billing, meteringService } = setup(event);

		await expect(
			billing.settleExisting({ actorUserId: "user_1" }, "attempt_1", 3),
		).resolves.toBe(true);
		expect(meteringService.settleMeasuredFromEvidence).not.toHaveBeenCalled();
	});

	it("fails closed when stored-output recovery has no financial event", async () => {
		const { billing, meteringService } = setup(null);

		await expect(
			billing.settleExisting({ actorUserId: "user_1" }, "attempt_1", 1),
		).resolves.toBe(false);
		expect(meteringService.settleMeasuredFromEvidence).not.toHaveBeenCalled();
	});

	it("settles delivered units from the local estimate", () => {
		expect(measuredOperationSettlement(measuredReservation())).toEqual({
			costUsdMicros: 268_800,
			finalCredits: 672,
			pricing: "direct",
			pricingSnapshot: {
				estimatedUnitUsdMicros: 134_400,
				mode: "measured",
				operation: "image",
				outcome: "delivered",
				source: "measured_local",
				unit: "image",
				units: 2,
				usdMicrosPerCredit: 40_000,
			},
		});
		expect(
			measuredOperationSettlement(measuredReservation(), { completedUnits: 1 }),
		).toMatchObject({
			costUsdMicros: 134_400,
			finalCredits: 336,
			pricingSnapshot: { outcome: "partial", units: 1 },
		});
	});

	it("settles a zero-unit failure at 0 credits with its cost recorded", () => {
		expect(
			measuredOperationSettlement(measuredReservation(), {
				completedUnits: 0,
				localCostUsdMicros: 134_400,
			}),
		).toMatchObject({
			costUsdMicros: 134_400,
			finalCredits: 0,
			pricingSnapshot: { outcome: "failed_no_deliverable", units: 0 },
		});
	});

	it("charges nothing for a known zero-cost render and the floor without a rate", () => {
		expect(
			measuredOperationSettlement(
				measuredReservation({ credits: 1, units: 1 }),
				{ localCostUsdMicros: 0 },
			),
		).toMatchObject({ costUsdMicros: 0, finalCredits: 0 });
		expect(
			measuredOperationSettlement(
				measuredReservation({
					credits: 700,
					terms: {
						estimatedUnitUsdMicros: null,
						mode: "measured",
						unit: "image",
						usdMicrosPerCredit: 40_000,
					},
				}),
				{ completedUnits: 1 },
			),
		).toMatchObject({
			costUsdMicros: null,
			finalCredits: 350,
			// The floor is a flat registry number, not a provider cost: flagged
			// so a ref-less event is never finalized silently.
			pricingSnapshot: { reviewFlags: ["no_catalog_rate"] },
		});
		expect(
			measuredDirectSettlement(measuredReservation(), { completedUnits: 1 })
				.pricingSnapshot,
		).not.toHaveProperty("reviewFlags");
	});

	it("settles a legacy fixed reservation under its reservation-time price", () => {
		expect(
			measuredOperationSettlement(
				measuredReservation({
					credits: 16,
					terms: { creditsPerUnit: 4, mode: "fixed", unit: "image" },
					units: 4,
				}),
				{ completedUnits: 1 },
			),
		).toEqual({
			finalCredits: 4,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerUnit: 4,
				mode: "fixed",
				operation: "image",
				source: "operation_registry",
				unit: "image",
				units: 1,
			},
		});
	});

	it("settles a token-priced operation from usage or the floor", () => {
		const reservation = measuredReservation({
			credits: 150,
			operation: "marketing",
			terms: { mode: "token", usdMicrosPerCredit: 40_000 },
			units: 1,
		});

		expect(
			measuredOperationSettlement(reservation, {
				tokenUsage: {
					modelId: "openai/gpt-4o-mini",
					usage: { inputTokens: 10, outputTokens: 20 },
				},
			}),
		).toMatchObject({ modelId: "openai/gpt-4o-mini", pricing: "token" });
		expect(measuredOperationSettlement(reservation)).toMatchObject({
			finalCredits: 150,
			pricingSnapshot: { mode: "token", source: "token_floor_recovery" },
		});
		expect(
			measuredOperationSettlement(reservation, { completedUnits: 0 }),
		).toMatchObject({
			finalCredits: 0,
			pricingSnapshot: { outcome: "failed_no_deliverable" },
		});
	});

	it("rebuilds terms from reservation, settlement, and reconciled snapshots", () => {
		expect(
			reservationTermsFromEvent(
				usageEvent({ pricingSnapshot: MEASURED_SNAPSHOT }),
			),
		).toEqual({
			estimatedUnitUsdMicros: 134_400,
			mode: "measured",
			unit: "image",
			usdMicrosPerCredit: 40_000,
		});
		expect(reservationTermsFromEvent(usageEvent())).toEqual({
			creditsPerUnit: 4,
			mode: "fixed",
			unit: "image",
		});
		expect(
			reservationTermsFromEvent(
				usageEvent({
					pricingSnapshot: {
						gatewayReconciliation: {},
						settlementPricingSnapshot: {
							...MEASURED_SNAPSHOT,
							source: "measured_local",
						},
					},
				}),
			),
		).toMatchObject({ estimatedUnitUsdMicros: 134_400, mode: "measured" });
		expect(
			reservationTermsFromEvent(
				usageEvent({ operation: "marketing", pricingSnapshot: null }),
			),
		).toEqual({ mode: "token", usdMicrosPerCredit: 32_000 });
	});
});
