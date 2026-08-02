import { describe, expect, it, vi } from "vitest";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import { createImageAnimationBilling } from "./image-animation-billing";

function setup(input?: { billingDisabled?: boolean }) {
	const event = { id: "event_1", reservedCredits: 25 } as Awaited<
		ReturnType<MeteringService["reserve"]>
	>;
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue({ id: "generation-ref-1" }),
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
	const billing = createImageAnimationBilling({
		isBillingDisabled: () => input?.billingDisabled ?? false,
		meteringService,
	});

	return { billing, event, meteringService };
}

describe("createImageAnimationBilling", () => {
	it("does not create an event when billing is off", async () => {
		const { billing, meteringService } = setup({ billingDisabled: true });
		meteringService.findByIdempotencyKey.mockResolvedValueOnce(null);

		const reservation = await billing.reserve("user_1", "attempt_1");

		expect(reservation).toEqual({
			credits: 25,
			eventId: null,
			operation: "video",
			referenceId: "attempt_1",
			replay: "none",
			units: 1,
		});
		await billing.capture(reservation, {
			providerMetadata: { gateway: { generationId: "generation_1" } },
		});
		await billing.settle(reservation);
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			"video:attempt_1",
			"user_1",
		);
		expect(meteringService.captureGeneration).not.toHaveBeenCalled();
		expect(meteringService.settle).not.toHaveBeenCalled();
	});

	it("preserves and validates an admission hold after billing is disabled", async () => {
		const { billing, event, meteringService } = setup({
			billingDisabled: true,
		});

		const reservation = await billing.reserve(
			"user_1",
			"attempt_1",
			"parent_1",
		);

		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			"video:attempt_1",
			"user_1",
		);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"video",
			"user_1",
			{
				attemptRef: "attempt_1",
				credits: 25,
				idempotencyKey: "video:attempt_1",
				parentEventId: "parent_1",
			},
		);
		expect(reservation).toMatchObject({ eventId: event.id, replay: "none" });
	});

	it("honors an enforced admission snapshot after the runtime switch turns off", async () => {
		const { billing, meteringService } = setup({ billingDisabled: true });

		await billing.reserve("user_1", "attempt_1", "parent_1", "enforce");

		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			"video:attempt_1",
			"user_1",
		);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledOnce();
	});

	it("does not create a hold when an off admission reaches an enforcing runtime", async () => {
		const { billing, meteringService } = setup({ billingDisabled: false });
		meteringService.findByIdempotencyKey.mockResolvedValueOnce(null);

		const reservation = await billing.reserve(
			"user_1",
			"attempt_1",
			undefined,
			"off",
		);

		expect(reservation.eventId).toBeNull();
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledOnce();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("reserves 25 credits with a stable operation key and parent", async () => {
		const { billing, event, meteringService } = setup();

		const reservation = await billing.reserve(
			"user_1",
			"attempt_1",
			"parent_1",
		);

		expect(reservation).toMatchObject({ credits: 25, eventId: event.id });
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"video",
			"user_1",
			{
				attemptRef: "attempt_1",
				credits: 25,
				idempotencyKey: "video:attempt_1",
				parentEventId: "parent_1",
			},
		);
	});

	it("captures the gateway generation and settles the registry price", async () => {
		const { billing, meteringService } = setup();
		const reservation = await billing.reserve("user_1", "attempt_1");
		const capture = {
			providerMetadata: { gateway: { generationId: "generation_1" } },
		};

		await billing.capture(reservation, capture);
		await billing.settle(reservation);

		expect(meteringService.captureGeneration).toHaveBeenCalledWith(
			"event_1",
			capture,
		);
		expect(meteringService.settle).toHaveBeenCalledWith("event_1", {
			finalCredits: 25,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerUnit: 25,
				mode: "fixed",
				operation: "video",
				source: "operation_registry",
				unit: "operation",
				units: 1,
			},
		});
	});

	it("settles zero delivered video units after a controlled storage failure", async () => {
		const { billing, meteringService } = setup();
		const reservation = await billing.reserve("user_1", "attempt_1");

		await billing.settle(reservation, 0);

		expect(meteringService.settle).toHaveBeenCalledWith(
			"event_1",
			expect.objectContaining({
				finalCredits: 0,
				pricingSnapshot: expect.objectContaining({ units: 0 }),
			}),
		);
	});

	it("fails capture when the gateway omits its generation id", async () => {
		const { billing, meteringService } = setup();
		const reservation = await billing.reserve("user_1", "attempt_1");
		meteringService.captureGeneration.mockResolvedValue(null);

		await expect(
			billing.capture(reservation, { providerMetadata: {} }),
		).rejects.toThrow("did not expose a gateway generation id");
		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
		expect(meteringService.settle).not.toHaveBeenCalled();
	});

	it("retries transient generation-ref writes before returning", async () => {
		const { billing, meteringService } = setup();
		const reservation = await billing.reserve("user_1", "attempt_1");
		meteringService.captureGeneration
			.mockRejectedValueOnce(new Error("capture timeout 1"))
			.mockRejectedValueOnce(new Error("capture timeout 2"));

		await expect(
			billing.capture(reservation, {
				providerMetadata: { gateway: { generationId: "generation_1" } },
			}),
		).resolves.toBeUndefined();
		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
	});

	it("refunds a prior event even when billing is now disabled", async () => {
		const { billing, meteringService } = setup({ billingDisabled: true });

		await billing.refund("user_1", "attempt_1");

		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			"video:attempt_1",
			"user_1",
		);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"event_1",
			"image_animation_failed",
		);
	});

	it("treats refund cleanup as a no-op after direct settlement", async () => {
		const { billing, meteringService } = setup();
		meteringService.findByIdempotencyKey.mockResolvedValueOnce({
			id: "event_1",
			status: "settled",
		} as never);

		await expect(
			billing.refund("user_1", "attempt_1"),
		).resolves.toBeUndefined();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("recognizes a fingerprint-matching reconcile_failed event as terminal", async () => {
		const { billing, meteringService } = setup();
		const terminal = {
			attemptRef: "attempt_1",
			chatId: null,
			estimatedCostUsdMicros: null,
			id: "event_1",
			idempotencyKey: "video:attempt_1",
			messageId: null,
			model: null,
			operation: "video",
			parentEventId: null,
			provider: null,
			reservedCredits: 25,
			status: "reconcile_failed",
		} as never;
		meteringService.reserveWithReplay.mockRejectedValueOnce(
			new MeteringStateConflictError(
				"event_1",
				"reconcile_failed",
				"replay reservation for",
			),
		);
		meteringService.findByIdempotencyKey.mockResolvedValue(terminal);

		await expect(billing.reserve("user_1", "attempt_1")).resolves.toMatchObject(
			{
				eventId: "event_1",
				replay: "reconcile_failed",
			},
		);
		await expect(billing.settleExisting("user_1", "attempt_1")).resolves.toBe(
			true,
		);
		expect(meteringService.settle).not.toHaveBeenCalled();
	});

	it("replays reconcile_failed from its reservation snapshot after registry price drift", async () => {
		const { billing, meteringService } = setup();
		const terminal = {
			attemptRef: "attempt_1",
			chatId: null,
			estimatedCostUsdMicros: null,
			id: "event_old_price",
			idempotencyKey: "video:attempt_1",
			messageId: null,
			model: null,
			operation: "video",
			parentEventId: null,
			pricingSnapshot: {
				creditsPerUnit: 20,
				mode: "fixed",
				operation: "video",
				source: "operation_registry_reservation",
				unit: "operation",
			},
			provider: null,
			reservedCredits: 20,
			status: "reconcile_failed",
		} as never;
		meteringService.reserveWithReplay.mockRejectedValueOnce(
			new MeteringStateConflictError(
				"event_old_price",
				"reconcile_failed",
				"replay reservation for",
			),
		);
		meteringService.findByIdempotencyKey.mockResolvedValueOnce(terminal);

		await expect(billing.reserve("user_1", "attempt_1")).resolves.toMatchObject(
			{
				credits: 20,
				eventId: "event_old_price",
				replay: "reconcile_failed",
				units: 1,
			},
		);
	});
});
