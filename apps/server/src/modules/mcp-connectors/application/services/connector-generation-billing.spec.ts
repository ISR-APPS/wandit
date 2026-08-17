import { describe, expect, it, vi } from "vitest";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { MeteringService } from "../../../metering/application/services/metering.service";

import {
	captureConnectorGenerationResult,
	connectorBillingAdmissionMode,
	createConnectorGenerationBilling,
	finalizeConnectorGenerationBilling,
} from "./connector-generation-billing";

type MeteringEvent = Awaited<ReturnType<MeteringService["reserve"]>>;

function buildBilling(options: { disabled?: boolean } = {}) {
	const events = new Map<string, MeteringEvent>();
	let eventIndex = 0;
	const settleDirectPair = vi.fn(
		async (parent: { eventId: string }, child?: { eventId: string }) => ({
			child: child ? ({ id: child.eventId } as MeteringEvent) : null,
			parent: { id: parent.eventId } as MeteringEvent,
		}),
	);
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue({ id: "generation-ref" }),
		findByIdempotencyKey: vi.fn(
			async (idempotencyKey: string) => events.get(idempotencyKey) ?? null,
		),
		refund: vi.fn(
			async (eventId: string) => ({ id: eventId }) as MeteringEvent,
		),
		reserveWithReplay: vi.fn(
			async (
				_operation: string,
				_subject: MeteringSubject,
				input: { credits: number; idempotencyKey: string },
			): Promise<Awaited<ReturnType<MeteringService["reserveWithReplay"]>>> => {
				eventIndex += 1;
				const event = {
					id: `event-${eventIndex}`,
					reservedCredits: input.credits,
				} as MeteringEvent;
				events.set(input.idempotencyKey, event);
				return { event, replay: "none", replayed: false } as const;
			},
		),
		settleDirectPair,
		settleDirectPairWithFixedEvidence: settleDirectPair,
		settle: vi.fn(
			async (eventId: string) => ({ id: eventId }) as MeteringEvent,
		),
		settleFixedFromEvidence: vi.fn(
			async (eventId: string) => ({ id: eventId }) as MeteringEvent,
		),
		upgradeFixedGenerationUnits: vi.fn().mockResolvedValue(null),
	};
	const billing = createConnectorGenerationBilling({
		isBillingDisabled: () => options.disabled === true,
		meteringService,
	});

	return { billing, events, meteringService };
}

describe("createConnectorGenerationBilling", () => {
	it("reserves and settles connector plus per-image child prices", async () => {
		const { billing, meteringService } = buildBilling();

		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-1",
			{
				childOperation: "image",
				childUnits: 3,
				parentEventId: "chat-event",
			},
		);
		await billing.settle(reservations);
		await billing.capture(reservations, {
			providerMetadata: { gateway: { generationId: "gen-1" } },
		});

		expect(meteringService.reserveWithReplay).toHaveBeenNthCalledWith(
			1,
			"connector",
			{ actorUserId: "user-1" },
			{
				attemptRef: "attempt-1",
				credits: 500,
				idempotencyKey: "connector:attempt-1",
				parentEventId: "chat-event",
			},
		);
		expect(meteringService.reserveWithReplay).toHaveBeenNthCalledWith(
			2,
			"image",
			{ actorUserId: "user-1" },
			{
				attemptRef: "attempt-1",
				credits: 900,
				idempotencyKey: "image:attempt-1",
				parentEventId: "event-1",
			},
		);
		expect(meteringService.settleDirectPair).toHaveBeenCalledWith(
			{
				eventId: "event-1",
				settlement: expect.objectContaining({
					finalCredits: 500,
					pricing: "direct",
				}),
			},
			{
				eventId: "event-2",
				settlement: expect.objectContaining({
					finalCredits: 900,
					pricing: "direct",
				}),
			},
			{ completedUnits: 3, eventId: "event-2" },
		);
		expect(meteringService.settle).not.toHaveBeenCalled();
		expect(meteringService.captureGeneration).toHaveBeenCalledWith("event-2", {
			providerMetadata: { gateway: { generationId: "gen-1" } },
		});
	});

	it("charges connector-only generation operations without a media child", async () => {
		const { billing, meteringService } = buildBilling();

		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-audio",
			{},
		);
		await billing.settle(reservations);

		expect(meteringService.reserveWithReplay).toHaveBeenCalledTimes(1);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"connector",
			{ actorUserId: "user-1" },
			expect.objectContaining({ credits: 500 }),
		);
		expect(meteringService.settle).not.toHaveBeenCalled();
		expect(meteringService.settleDirectPair).toHaveBeenCalledWith(
			expect.objectContaining({ eventId: "event-1" }),
			undefined,
			{ completedUnits: 1, eventId: "event-1" },
		);
	});

	it("refunds unused image units when three requested images return one", async () => {
		const { billing, meteringService } = buildBilling();
		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-images",
			{
				childOperation: "image",
				childUnits: 3,
			},
		);

		await billing.settle(reservations, { childUnits: 1 });

		expect(meteringService.settleDirectPair).toHaveBeenCalledWith(
			expect.objectContaining({
				settlement: expect.objectContaining({ finalCredits: 500 }),
			}),
			expect.objectContaining({
				settlement: expect.objectContaining({
					finalCredits: 300,
					pricingSnapshot: expect.objectContaining({ units: 1 }),
				}),
			}),
			{ completedUnits: 1, eventId: "event-2" },
		);
	});

	it("settles a partial child with the queue-time unit prices after registry drift", async () => {
		const { billing, meteringService } = buildBilling();

		await billing.settle(
			{
				child: {
					credits: 1400,
					eventId: "old-child",
					operation: "image",
					referenceId: "attempt-old-price",
					replay: "none",
					units: 2,
				},
				connector: {
					credits: 300,
					eventId: "old-parent",
					operation: "connector",
					referenceId: "attempt-old-price",
					replay: "none",
					units: 1,
				},
			},
			{ childUnits: 1 },
		);

		expect(meteringService.settleDirectPair).toHaveBeenCalledWith(
			expect.objectContaining({
				settlement: expect.objectContaining({
					finalCredits: 300,
					pricingSnapshot: expect.objectContaining({ creditsPerUnit: 300 }),
				}),
			}),
			expect.objectContaining({
				settlement: expect.objectContaining({
					finalCredits: 700,
					pricingSnapshot: expect.objectContaining({
						creditsPerUnit: 700,
						units: 1,
					}),
				}),
			}),
			{ completedUnits: 1, eventId: "old-child" },
		);
	});

	it("captures a receipt generation id before a later follow failure", async () => {
		const { billing, meteringService } = buildBilling();
		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-receipt",
			{
				childOperation: "image",
				childUnits: 1,
			},
		);
		const follow = vi.fn(async () => {
			throw new Error("follow failed");
		});

		await expect(
			(async () => {
				await captureConnectorGenerationResult(billing, reservations, {
					providerMetadata: {
						gateway: { generationId: "receipt-generation" },
					},
				});
				await follow();
			})(),
		).rejects.toThrow("follow failed");
		expect(meteringService.captureGeneration).toHaveBeenCalledWith("event-2", {
			providerMetadata: {
				gateway: { generationId: "receipt-generation" },
			},
			stepUsage: {
				metering: { fixedUnits: 0 },
				providerUsage: null,
			},
		});
		expect(
			meteringService.captureGeneration.mock.invocationCallOrder[0],
		).toBeLessThan(
			follow.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
	});

	it("refunds the connector hold and preserves a child reservation 402", async () => {
		const { billing, events, meteringService } = buildBilling();
		const paymentRequired = new InsufficientCreditsError(25, 2);
		meteringService.reserveWithReplay
			.mockImplementationOnce(async (_operation, _subject, input) => {
				const event = { id: "connector-event" } as MeteringEvent;
				events.set(input.idempotencyKey, event);
				return { event, replay: "none", replayed: false } as const;
			})
			.mockRejectedValueOnce(paymentRequired);

		await expect(
			billing.reserve({ actorUserId: "user-1" }, "attempt-video", {
				childOperation: "video",
				childUnits: 1,
				parentEventId: "chat-event",
			}),
		).rejects.toBe(paymentRequired);
		expect(meteringService.refund).toHaveBeenCalledWith(
			"connector-event",
			"connector_child_reserve_failed",
		);
	});

	it("preserves billing-off execution without metering side effects", async () => {
		const { billing, meteringService } = buildBilling({ disabled: true });

		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-off",
			{
				childOperation: "video",
				childUnits: 1,
			},
		);
		await billing.settle(reservations);

		expect(reservations.connector.eventId).toBeNull();
		expect(reservations.child?.eventId).toBeNull();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
		expect(meteringService.settle).not.toHaveBeenCalled();
		expect(meteringService.settleDirectPair).not.toHaveBeenCalled();
		expect(connectorBillingAdmissionMode(reservations)).toBe("off");
	});

	it("rejects an inconsistent parent/child admission snapshot", () => {
		expect(() =>
			connectorBillingAdmissionMode({
				child: {
					credits: 300,
					eventId: null,
					operation: "image",
					referenceId: "attempt-mixed",
					replay: "none",
					units: 1,
				},
				connector: {
					credits: 500,
					eventId: "event-parent",
					operation: "connector",
					referenceId: "attempt-mixed",
					replay: "none",
					units: 1,
				},
			}),
		).toThrow("Connector parent and child billing must be enabled together");
	});

	it("rejects terminal connector replays before reserving a child", async () => {
		const { billing, meteringService } = buildBilling();
		const event = { id: "settled-connector" } as MeteringEvent;
		meteringService.reserveWithReplay.mockResolvedValueOnce({
			event,
			replay: "settled",
			replayed: true,
		});

		await expect(
			billing.reserve({ actorUserId: "user-1" }, "attempt-terminal", {
				childOperation: "image",
				childUnits: 1,
			}),
		).rejects.toMatchObject({
			eventId: "settled-connector",
			name: "MeteringStateConflictError",
			status: "settled",
		});
		expect(meteringService.reserveWithReplay).toHaveBeenCalledTimes(1);
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("captures every gateway id before settlement and retries idempotent writes", async () => {
		const { billing, meteringService } = buildBilling();
		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-retry",
			{
				childOperation: "image",
				childUnits: 1,
			},
		);
		meteringService.captureGeneration
			.mockRejectedValueOnce(new Error("transient capture 1"))
			.mockRejectedValueOnce(new Error("transient capture 2"))
			.mockResolvedValue({ id: "generation-ref" });

		await finalizeConnectorGenerationBilling(billing, reservations, [
			{ providerMetadata: { gateway: { generationId: "gen-1" } } },
			{ providerMetadata: { gateway: { generationId: "gen-2" } } },
		]);

		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(4);
		expect(meteringService.captureGeneration).toHaveBeenLastCalledWith(
			"event-2",
			{
				providerMetadata: { gateway: { generationId: "gen-2" } },
				stepUsage: {
					metering: { fixedUnits: 0 },
					providerUsage: null,
				},
			},
		);
		expect(meteringService.settleDirectPair).toHaveBeenCalledTimes(1);
		const lastCaptureOrder =
			meteringService.captureGeneration.mock.invocationCallOrder.at(-1);
		const firstSettleOrder =
			meteringService.settleDirectPair.mock.invocationCallOrder[0];
		expect(lastCaptureOrder).toBeDefined();
		expect(firstSettleOrder).toBeDefined();
		expect(lastCaptureOrder as number).toBeLessThan(firstSettleOrder as number);
	});

	it("atomically preserves connector and child fees across a lost commit response without provider replay", async () => {
		const { billing, meteringService } = buildBilling();
		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-crash",
			{
				childOperation: "video",
				childUnits: 1,
			},
		);
		// External MCP generations commonly expose no Gateway generation id.
		const provider = vi.fn(async () => []);
		const captures = await provider();
		const settledEventIds = new Set<string>();
		const commitPair = async (
			parent: { eventId: string },
			child?: { eventId: string },
		) => {
			settledEventIds.add(parent.eventId);
			if (child) {
				settledEventIds.add(child.eventId);
			}

			return {
				child: child ? ({ id: child.eventId } as MeteringEvent) : null,
				parent: { id: parent.eventId } as MeteringEvent,
			};
		};
		meteringService.settleDirectPair
			.mockImplementationOnce(async (parent, child) => {
				await commitPair(parent, child);
				throw new Error("connection lost after atomic commit");
			})
			.mockImplementation(commitPair);

		await expect(
			finalizeConnectorGenerationBilling(billing, reservations, captures, 1),
		).rejects.toThrow("connection lost after atomic commit");

		expect(settledEventIds).toEqual(new Set(["event-1", "event-2"]));
		expect(meteringService.captureGeneration).not.toHaveBeenCalled();
		expect(meteringService.settleDirectPair).toHaveBeenCalledTimes(1);
		expect(meteringService.refund).not.toHaveBeenCalled();

		// A task/API retry replays only durable billing writes with the already
		// captured provider result. Parent settlement is idempotent; the child can
		// now finish without invoking or refunding provider work again.
		await finalizeConnectorGenerationBilling(
			billing,
			reservations,
			captures,
			1,
		);

		expect(provider).toHaveBeenCalledTimes(1);
		expect(settledEventIds).toEqual(new Set(["event-1", "event-2"]));
		expect(meteringService.settleDirectPair).toHaveBeenCalledTimes(2);
		expect(meteringService.settle).not.toHaveBeenCalled();
		expect(meteringService.refund).not.toHaveBeenCalled();
	});

	it("propagates terminal generation-ref persistence failure without settling", async () => {
		const { billing, meteringService } = buildBilling();
		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-failed",
			{},
		);
		const persistenceError = new Error("generation ref unavailable");
		meteringService.captureGeneration.mockRejectedValue(persistenceError);

		await expect(
			finalizeConnectorGenerationBilling(billing, reservations, [
				{ providerMetadata: { gateway: { generationId: "gen-failed" } } },
			]),
		).rejects.toBe(persistenceError);
		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
		expect(meteringService.settle).not.toHaveBeenCalled();
		expect(meteringService.settleDirectPair).not.toHaveBeenCalled();
	});
});
