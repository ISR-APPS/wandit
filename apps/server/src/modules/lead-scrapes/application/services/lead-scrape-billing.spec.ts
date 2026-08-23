import { describe, expect, it, vi } from "vitest";

import type { AiUsageEvent } from "../../../metering/domain/metering";
import {
	ensureLeadScrapeUsageSettled,
	type LeadScrapeMeteringService,
	recordSerperEvidence,
	refundLeadScrapeUsageIfReserved,
	reserveLeadScrapeUsage,
	reserveLeadScrapeUsageForExecution,
	serperCostUsdMicros,
	settleLeadScrapeUsage,
} from "./lead-scrape-billing";

const PER_LEAD_SNAPSHOT = {
	creditsPerUnit: 5,
	minimumCredits: 100,
	mode: "fixed",
	operation: "lead_scrape",
	source: "operation_registry",
	unit: "lead",
};

function buildMetering(
	status: AiUsageEvent["status"] = "reserved",
	options: {
		existing?: AiUsageEvent | null;
		reservedCredits?: number;
		/** Durable Serper receipt rows of the event (units = pages). */
		serperEvidence?: Array<{ idempotencyKey: string; units: number }>;
	} = {},
) {
	const event = {
		id: "usage-event-1",
		pricingSnapshot: null,
		reservedCredits: options.reservedCredits ?? 250,
		status,
	} as AiUsageEvent;
	const meteringService = {
		findByIdempotencyKey: vi.fn(async () =>
			options.existing === undefined ? event : options.existing,
		),
		listProviderCallEvidence: vi.fn(async () => options.serperEvidence ?? []),
		refund: vi.fn(async () => event),
		refundWithProviderCost: vi.fn(async () => event),
		reserveWithReplay: vi.fn(async () => {
			if (status === "refunded" || status === "reconcile_failed") {
				throw new Error(`core rejected ${status} replay`);
			}

			return status === "reserved"
				? { event, replay: "none", replayed: false }
				: { event, replay: status, replayed: true };
		}),
		settle: vi.fn(async () => event),
	} as unknown as LeadScrapeMeteringService;

	return { event, meteringService };
}

describe("lead scrape billing", () => {
	it("prices the Serper provider cost per page", () => {
		expect(serperCostUsdMicros(0)).toBe(0);
		expect(serperCostUsdMicros(3)).toBe(3_000);
		expect(() => serperCostUsdMicros(-1)).toThrow("non-negative integer");
	});

	it("reserves the per-lead product price for the requested limit", async () => {
		const { event, meteringService } = buildMetering("reserved", {
			existing: null,
		});

		await expect(
			reserveLeadScrapeUsage(meteringService, {
				attemptId: "attempt-1",
				parentEventId: "chat-event-1",
				requestedLimit: 50,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(event);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"lead_scrape",
			{ actorUserId: "user-1" },
			{
				attemptRef: "attempt-1",
				credits: 250,
				idempotencyKey: "lead-scrape:attempt-1",
				parentEventId: "chat-event-1",
			},
		);
	});

	it("holds at least one credit for a small limit", async () => {
		const { meteringService } = buildMetering("reserved", { existing: null });

		await reserveLeadScrapeUsage(meteringService, {
			attemptId: "attempt-small",
			requestedLimit: 5,
			subject: { actorUserId: "user-1" },
		});

		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"lead_scrape",
			{ actorUserId: "user-1" },
			expect.objectContaining({ credits: 100 }),
		);
	});

	it("uses one stable attempt-scoped reservation across task runs", async () => {
		// The Trigger run replays the chat-tool hold with its own size, even if
		// the limit or the price changed in between.
		const { event, meteringService } = buildMetering("reserved", {
			reservedCredits: 500,
		});

		await expect(
			reserveLeadScrapeUsage(meteringService, {
				attemptId: "attempt-1",
				parentEventId: "chat-event-1",
				requestedLimit: 50,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(event);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"lead_scrape",
			{ actorUserId: "user-1" },
			expect.objectContaining({ credits: 500 }),
		);
	});

	it.each([
		"settled",
		"reconciled",
	] as const)("rejects a %s reservation replay before provider work", async (status) => {
		const { meteringService } = buildMetering(status);

		await expect(
			reserveLeadScrapeUsage(meteringService, {
				attemptId: "attempt-1",
				requestedLimit: 20,
				subject: { actorUserId: "user-1" },
			}),
		).rejects.toThrow(`cannot execute with ${status} metering`);
	});

	it("preserves the core rejection of a refunded reservation replay", async () => {
		const { meteringService } = buildMetering("refunded");

		await expect(
			reserveLeadScrapeUsage(meteringService, {
				attemptId: "attempt-1",
				requestedLimit: 20,
				subject: { actorUserId: "user-1" },
			}),
		).rejects.toThrow("core rejected refunded replay");
	});

	it("replays a queue-time hold when billing is disabled before execution", async () => {
		const { event, meteringService } = buildMetering();

		await expect(
			reserveLeadScrapeUsageForExecution(meteringService, {
				attemptId: "attempt-1",
				parentEventId: "chat-event-1",
				requestedLimit: 20,
				runtimeBillingDisabled: true,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(event);
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			"lead-scrape:attempt-1",
			{ actorUserId: "user-1" },
		);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledOnce();
	});

	it("does not create a hold for a billing-off attempt with no prior event", async () => {
		const { meteringService } = buildMetering("reserved", { existing: null });

		await expect(
			reserveLeadScrapeUsageForExecution(meteringService, {
				attemptId: "attempt-off",
				requestedLimit: 20,
				runtimeBillingDisabled: true,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBeNull();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("honors an enforce admission snapshot after the runtime switch turns off", async () => {
		const { event, meteringService } = buildMetering();

		await expect(
			reserveLeadScrapeUsageForExecution(meteringService, {
				attemptId: "attempt-enforced",
				billingMode: "enforce",
				requestedLimit: 20,
				runtimeBillingDisabled: true,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(event);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledOnce();
	});

	it("honors an off admission snapshot after the runtime switch turns on", async () => {
		const { meteringService } = buildMetering("reserved", { existing: null });

		await expect(
			reserveLeadScrapeUsageForExecution(meteringService, {
				attemptId: "attempt-off",
				billingMode: "off",
				requestedLimit: 20,
				runtimeBillingDisabled: false,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBeNull();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("settles per delivered lead with the Serper cost and repairs a reserved succeeded attempt", async () => {
		// The page count comes from the original run's durable Serper receipt,
		// never from a constant.
		const { meteringService } = buildMetering("reserved", {
			serperEvidence: [{ idempotencyKey: "serper:attempt-1", units: 2 }],
		});

		await expect(
			ensureLeadScrapeUsageSettled(meteringService, {
				attemptId: "attempt-1",
				deliveredLeads: 27,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(true);
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			"lead-scrape:attempt-1",
			{ actorUserId: "user-1" },
		);
		expect(meteringService.listProviderCallEvidence).toHaveBeenCalledWith(
			"usage-event-1",
		);
		expect(meteringService.settle).toHaveBeenCalledWith("usage-event-1", {
			costUsdMicros: 2_000,
			finalCredits: 135,
			pricing: "direct",
			pricingSnapshot: { ...PER_LEAD_SNAPSHOT, units: 27 },
			rawUsage: { provider: "serper", resultCount: 27, serperPages: 2 },
		});
	});

	it("records zero Serper pages for a reserved succeeded attempt without a receipt", async () => {
		const { meteringService } = buildMetering("reserved", {
			serperEvidence: [{ idempotencyKey: "serper:other-attempt", units: 5 }],
		});

		await expect(
			ensureLeadScrapeUsageSettled(meteringService, {
				attemptId: "attempt-1",
				deliveredLeads: 27,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(true);
		expect(meteringService.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				costUsdMicros: 0,
				finalCredits: 135,
				rawUsage: { provider: "serper", resultCount: 27, serperPages: 0 },
			}),
		);
	});

	it.each([
		"settled",
		"reconciled",
		"reconcile_failed",
		"refunded",
	] as const)("short-circuits a duplicate delivery of a %s scrape without a settle replay", async (status) => {
		// Reviewer scenario: the original run settled a 3-page scrape
		// (serperPages 3, costUsdMicros 3000). A duplicate Trigger delivery
		// must not replay settle with a different page count — that threw a
		// settle replay conflict and failed the run.
		const { meteringService } = buildMetering(status, {
			serperEvidence: [{ idempotencyKey: "serper:attempt-1", units: 3 }],
		});

		await expect(
			ensureLeadScrapeUsageSettled(meteringService, {
				attemptId: "attempt-1",
				deliveredLeads: 60,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(true);
		expect(meteringService.settle).not.toHaveBeenCalled();
	});

	it("charges the one-credit minimum for a small delivery", async () => {
		const { event, meteringService } = buildMetering();

		await settleLeadScrapeUsage(meteringService, event, {
			deliveredLeads: 3,
			serperPages: 1,
		});

		expect(meteringService.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				costUsdMicros: 1_000,
				finalCredits: 100,
				rawUsage: { provider: "serper", resultCount: 3, serperPages: 1 },
			}),
		);
	});

	it("settles a hold admitted under the retired flat price at that price", async () => {
		const { event, meteringService } = buildMetering("reserved", {
			reservedCredits: 500,
		});

		await settleLeadScrapeUsage(
			meteringService,
			{
				...event,
				pricingSnapshot: {
					creditsPerUnit: 500,
					mode: "fixed",
					operation: "lead_scrape",
					source: "operation_registry_reservation",
					unit: "operation",
				},
			},
			{ deliveredLeads: 120, serperPages: 6 },
		);

		expect(meteringService.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				costUsdMicros: 6_000,
				finalCredits: 500,
				pricingSnapshot: expect.objectContaining({
					creditsPerOperation: 500,
					unit: "operation",
				}),
			}),
		);
	});

	it("does not retroactively charge a succeeded billing-off attempt", async () => {
		const { meteringService } = buildMetering("reserved", { existing: null });

		await expect(
			ensureLeadScrapeUsageSettled(meteringService, {
				attemptId: "legacy-attempt",
				deliveredLeads: 10,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(false);
		expect(meteringService.settle).not.toHaveBeenCalled();
	});

	it("refunds the matching reserved event fully while recording the Serper cost", async () => {
		const reserved = buildMetering();

		await expect(
			refundLeadScrapeUsageIfReserved(reserved.meteringService, {
				attemptId: "attempt-1",
				eventId: "usage-event-1",
				serperPages: 4,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(true);
		expect(
			reserved.meteringService.refundWithProviderCost,
		).toHaveBeenCalledWith("usage-event-1", 4_000, "lead_scrape_failed");
		expect(reserved.meteringService.refund).not.toHaveBeenCalled();

		const settled = buildMetering("settled");
		await expect(
			refundLeadScrapeUsageIfReserved(settled.meteringService, {
				attemptId: "attempt-1",
				eventId: "usage-event-1",
				serperPages: 4,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(false);
		expect(
			settled.meteringService.refundWithProviderCost,
		).not.toHaveBeenCalled();
	});

	it("writes one contract-rate Serper receipt per attempt and raises it monotonically", async () => {
		const captureProviderCallEvidence = vi
			.fn()
			.mockResolvedValueOnce({ id: "evidence-1", units: 2 })
			.mockResolvedValueOnce({ id: "evidence-1", units: 2 });
		const settleProviderCallEvidenceCost = vi.fn(async () => ({
			id: "evidence-1",
		}));
		const meteringService = {
			captureProviderCallEvidence,
			settleProviderCallEvidenceCost,
		} as unknown as Pick<
			LeadScrapeMeteringService,
			"captureProviderCallEvidence" | "settleProviderCallEvidenceCost"
		>;

		await recordSerperEvidence(meteringService, {
			attemptId: "attempt-1",
			eventId: "usage-event-1",
			pages: 2,
		});
		expect(captureProviderCallEvidence).toHaveBeenCalledWith("usage-event-1", {
			chargedUsdMicros: 2_000,
			costSource: "serper_contract_env",
			costStatus: "contract_rate",
			customerBillable: false,
			idempotencyKey: "serper:attempt-1",
			providerRequestId: "attempt-1",
			rateUsdMicrosPerUnit: 1_000,
			transport: "serper",
			unitKind: "search_page",
			units: 2,
		});
		expect(settleProviderCallEvidenceCost).not.toHaveBeenCalled();

		// A later flush with more pages upgrades the existing row.
		await recordSerperEvidence(meteringService, {
			attemptId: "attempt-1",
			eventId: "usage-event-1",
			pages: 5,
		});
		expect(settleProviderCallEvidenceCost).toHaveBeenCalledWith("evidence-1", {
			chargedUsdMicros: 5_000,
			costSource: "serper_contract_env",
			costStatus: "contract_rate",
			rateUsdMicrosPerUnit: 1_000,
			units: 5,
		});

		// Zero pages means Serper was never called: no row.
		captureProviderCallEvidence.mockClear();
		await recordSerperEvidence(meteringService, {
			attemptId: "attempt-2",
			eventId: "usage-event-2",
			pages: 0,
		});
		expect(captureProviderCallEvidence).not.toHaveBeenCalled();
	});
});
