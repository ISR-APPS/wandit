import { describe, expect, it, vi } from "vitest";

import type { AiUsageEvent } from "../../domain/metering";
import {
	createFixedOperationBilling,
	fixedOperationSettlementFromReservation,
} from "./fixed-operation-billing";

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
		outputTokens: null,
		parentEventId: null,
		pricingSnapshot: {
			creditsPerUnit: 4,
			mode: "fixed",
			operation: "image",
			reserveFloorCredits: 5,
			source: "operation_registry_reservation",
			unit: "image",
			usdMicrosPerCredit: 50_000,
		},
		provider: null,
		rawUsage: null,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: 16,
		settledAt: null,
		status: "reserved",
		userId: "user_1",
		...overrides,
	};
}

function setup(event: AiUsageEvent | null) {
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue({ id: "ref_1" }),
		findByIdempotencyKey: vi.fn().mockResolvedValue(event),
		refund: vi.fn().mockResolvedValue(event),
		reserveWithReplay: vi.fn().mockImplementation(async () => ({
			event,
			replay: event?.status ?? "none",
			replayed: true,
		})),
		settle: vi.fn().mockResolvedValue(event),
		settleFixedFromEvidence: vi.fn().mockResolvedValue(event),
	};
	const billing = createFixedOperationBilling("image", {
		isBillingDisabled: () => false,
		meteringService,
	});

	return { billing, meteringService };
}

describe("createFixedOperationBilling", () => {
	it("replays an existing reservation with its durable pre-deploy unit price", async () => {
		const event = usageEvent();
		const { billing, meteringService } = setup(event);

		const reservation = await billing.reserve("user_1", "attempt_1", {
			units: 4,
		});

		expect(reservation).toMatchObject({ credits: 16, replay: "reserved" });
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			"user_1",
			{
				attemptRef: "attempt_1",
				credits: 16,
				idempotencyKey: "image:attempt_1",
				parentEventId: undefined,
			},
		);
	});

	it("validates reconcile-failed replay against durable pricing after drift", async () => {
		const event = usageEvent({
			reconciledAt: new Date("2026-08-01T00:01:00.000Z"),
			status: "reconcile_failed",
		});
		const { billing, meteringService } = setup(event);

		await expect(
			billing.reserve("user_1", "attempt_1", { units: 4 }),
		).resolves.toMatchObject({
			credits: 16,
			eventId: event.id,
			replay: "reconcile_failed",
		});
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("settles stored output through the atomic fixed-evidence API", async () => {
		const event = usageEvent();
		const { billing, meteringService } = setup(event);

		await expect(
			billing.settleExisting("user_1", "attempt_1", 3),
		).resolves.toBe(true);
		expect(meteringService.settleFixedFromEvidence).toHaveBeenCalledWith(
			event.id,
			3,
		);
	});

	it("financially settles an unpriced reconcile-failed stored output", async () => {
		const event = usageEvent({
			reconciledAt: new Date("2026-08-01T00:01:00.000Z"),
			status: "reconcile_failed",
		});
		const { billing, meteringService } = setup(event);

		await expect(
			billing.settleExisting("user_1", "attempt_1", 2),
		).resolves.toBe(true);
		expect(meteringService.settleFixedFromEvidence).toHaveBeenCalledWith(
			event.id,
			2,
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
			billing.settleExisting("user_1", "attempt_1", 3),
		).resolves.toBe(true);
		expect(meteringService.settleFixedFromEvidence).not.toHaveBeenCalled();
	});

	it("fails closed when stored-output recovery has no financial event", async () => {
		const { billing, meteringService } = setup(null);

		await expect(
			billing.settleExisting("user_1", "attempt_1", 1),
		).resolves.toBe(false);
		expect(meteringService.settleFixedFromEvidence).not.toHaveBeenCalled();
	});

	it("builds partial settlement from the immutable reservation unit price", () => {
		expect(
			fixedOperationSettlementFromReservation(
				{
					credits: 16,
					eventId: "event_1",
					operation: "image",
					referenceId: "attempt_1",
					replay: "none",
					units: 4,
				},
				1,
			),
		).toMatchObject({
			finalCredits: 4,
			pricingSnapshot: { creditsPerUnit: 4, units: 1 },
		});
	});
});
