import { describe, expect, it, vi } from "vitest";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { MeteringService } from "../../../metering/application/services/metering.service";

import {
	captureConnectorGenerationResult,
	connectorBillingAdmissionMode,
	createConnectorGenerationBilling,
	finalizeConnectorGenerationBilling,
	recordConnectorSubmitReceipt,
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
		captureProviderCallEvidence: vi.fn(
			async (eventId: string, evidence: { idempotencyKey: string }) =>
				({
					id: `evidence:${evidence.idempotencyKey}`,
					usageEventId: eventId,
				}) as Awaited<
					ReturnType<MeteringService["captureProviderCallEvidence"]>
				>,
		),
		findByIdempotencyKey: vi.fn(
			async (idempotencyKey: string) => events.get(idempotencyKey) ?? null,
		),
		refund: vi.fn(
			async (eventId: string) => ({ id: eventId }) as MeteringEvent,
		),
		reserveWithReplay: vi.fn(
			async (
				operation: string,
				_subject: MeteringSubject,
				input: {
					credits: number;
					estimatedCostUsdMicros?: number | null;
					idempotencyKey: string;
					measuredTerms?: { estimatedUnitUsdMicros: number | null } | null;
				},
			): Promise<Awaited<ReturnType<MeteringService["reserveWithReplay"]>>> => {
				eventIndex += 1;
				const event = {
					estimatedCostUsdMicros: input.estimatedCostUsdMicros ?? null,
					id: `event-${eventIndex}`,
					operation,
					pricingSnapshot: {
						estimatedUnitUsdMicros:
							input.measuredTerms?.estimatedUnitUsdMicros ?? null,
						mode: "measured",
						operation,
						source: "operation_registry_reservation",
						unit: operation === "image" ? "image" : "operation",
						usdMicrosPerCredit: 40_000,
					},
					reservedCredits: input.credits,
				} as unknown as MeteringEvent;
				events.set(input.idempotencyKey, event);
				return { event, replay: "none", replayed: false } as const;
			},
		),
		settleDirectPair,
		settleDirectPairWithFixedEvidence: settleDirectPair,
		settle: vi.fn(
			async (eventId: string) => ({ id: eventId }) as MeteringEvent,
		),
		settleMeasuredFromEvidence: vi.fn(
			async (eventId: string) => ({ id: eventId }) as MeteringEvent,
		),
		upgradeFixedGenerationUnits: vi.fn().mockResolvedValue(null),
		usdMicrosPerCredit: 40_000,
	};
	const billing = createConnectorGenerationBilling({
		isBillingDisabled: () => options.disabled === true,
		meteringService,
	});

	return { billing, events, meteringService };
}

describe("createConnectorGenerationBilling", () => {
	// The MCP render runs on the user's own Higgsfield subscription: the
	// connector call and its media child hold 1 cc each and settle at zero
	// provider cost. Gateway-shaped refs in the result still reconcile.
	it("holds one centi-credit per event and settles connector plus child at zero cost", async () => {
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
				credits: 1,
				estimatedCostUsdMicros: null,
				idempotencyKey: "connector:attempt-1",
				measuredTerms: { estimatedUnitUsdMicros: null, units: 1 },
				parentEventId: "chat-event",
			},
		);
		expect(meteringService.reserveWithReplay).toHaveBeenNthCalledWith(
			2,
			"image",
			{ actorUserId: "user-1" },
			{
				attemptRef: "attempt-1",
				credits: 1,
				estimatedCostUsdMicros: 0,
				idempotencyKey: "image:attempt-1",
				measuredTerms: { estimatedUnitUsdMicros: 0, units: 3 },
				parentEventId: "event-1",
			},
		);
		expect(meteringService.settleDirectPair).toHaveBeenCalledWith(
			{
				eventId: "event-1",
				settlement: expect.objectContaining({
					costUsdMicros: 0,
					finalCredits: 0,
					pricing: "direct",
					pricingSnapshot: expect.objectContaining({
						mode: "measured",
						operation: "connector",
						source: "measured_local",
					}),
				}),
			},
			{
				eventId: "event-2",
				settlement: expect.objectContaining({
					costUsdMicros: 0,
					finalCredits: 0,
					pricing: "direct",
					pricingSnapshot: expect.objectContaining({ units: 3 }),
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
			expect.objectContaining({ credits: 1 }),
		);
		expect(meteringService.settle).not.toHaveBeenCalled();
		expect(meteringService.settleDirectPair).toHaveBeenCalledWith(
			expect.objectContaining({
				eventId: "event-1",
				settlement: expect.objectContaining({ finalCredits: 0 }),
			}),
			undefined,
			{ completedUnits: 1, eventId: "event-1" },
		);
	});

	it("records the delivered child unit count when three requested images return one", async () => {
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
				settlement: expect.objectContaining({ finalCredits: 0 }),
			}),
			expect.objectContaining({
				settlement: expect.objectContaining({
					finalCredits: 0,
					pricingSnapshot: expect.objectContaining({
						outcome: "partial",
						units: 1,
					}),
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
					terms: { creditsPerUnit: 700, mode: "fixed", unit: "image" },
					units: 2,
				},
				connector: {
					credits: 300,
					eventId: "old-parent",
					operation: "connector",
					referenceId: "attempt-old-price",
					replay: "none",
					terms: { creditsPerUnit: 300, mode: "fixed", unit: "operation" },
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
				const event = {
					id: "connector-event",
					operation: "connector",
				} as MeteringEvent;
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
					credits: 1,
					eventId: null,
					operation: "image",
					referenceId: "attempt-mixed",
					replay: "none",
					terms: {
						estimatedUnitUsdMicros: 0,
						mode: "measured",
						unit: "image",
						usdMicrosPerCredit: 40_000,
					},
					units: 1,
				},
				connector: {
					credits: 1,
					eventId: "event-parent",
					operation: "connector",
					referenceId: "attempt-mixed",
					replay: "none",
					terms: {
						estimatedUnitUsdMicros: null,
						mode: "measured",
						unit: "operation",
						usdMicrosPerCredit: 40_000,
					},
					units: 1,
				},
			}),
		).toThrow("Connector parent and child billing must be enabled together");
	});

	it("rejects terminal connector replays before reserving a child", async () => {
		const { billing, meteringService } = buildBilling();
		const event = {
			id: "settled-connector",
			operation: "connector",
		} as MeteringEvent;
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

describe("recordConnectorSubmitReceipt", () => {
	it("persists a zero-cost measured Higgsfield receipt on the child event with the provider job id", async () => {
		const { billing, meteringService } = buildBilling();
		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-1",
			{ childOperation: "video", childUnits: 1 },
		);

		const jobId = await recordConnectorSubmitReceipt(billing, reservations, {
			connectorSlug: "higgsfield",
			plan: { childOperation: "video", childUnits: 1 },
			referenceId: "attempt-1",
			result: {
				content: [
					{
						text: JSON.stringify({ job_set_id: "js-9", status: "queued" }),
						type: "text",
					},
				],
			},
		});

		expect(jobId).toBe("js-9");
		expect(meteringService.captureProviderCallEvidence).toHaveBeenCalledWith(
			reservations.child?.eventId,
			expect.objectContaining({
				chargedUsdMicros: 0,
				costStatus: "measured",
				customerBillable: false,
				idempotencyKey: "higgsfield:attempt-1:js-9",
				providerRequestId: "js-9",
				transport: "higgsfield",
				unitKind: "video",
				units: 1,
			}),
		);
	});

	it("records an mcp receipt on the connector event when the receipt has no job id", async () => {
		const { billing, meteringService } = buildBilling();
		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-2",
			{},
		);

		const jobId = await recordConnectorSubmitReceipt(billing, reservations, {
			connectorSlug: "other-mcp",
			plan: {},
			referenceId: "attempt-2",
			result: { content: [{ text: "ok", type: "text" }] },
		});

		expect(jobId).toBeNull();
		expect(meteringService.captureProviderCallEvidence).toHaveBeenCalledWith(
			reservations.connector.eventId,
			expect.objectContaining({
				idempotencyKey: "mcp:attempt-2:submit",
				providerRequestId: "attempt-2",
				transport: "mcp",
				unitKind: "operation",
				units: 1,
			}),
		);
	});

	it("writes nothing when billing is off", async () => {
		const { billing, meteringService } = buildBilling({ disabled: true });
		const reservations = await billing.reserve(
			{ actorUserId: "user-1" },
			"attempt-3",
			{},
		);

		await recordConnectorSubmitReceipt(billing, reservations, {
			connectorSlug: "higgsfield",
			plan: {},
			referenceId: "attempt-3",
			result: {},
		});

		expect(meteringService.captureProviderCallEvidence).not.toHaveBeenCalled();
	});
});
