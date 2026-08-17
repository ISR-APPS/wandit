import { describe, expect, it, vi } from "vitest";

import type { AiUsageEvent } from "../../../metering/domain/metering";
import {
	ensureLeadScrapeUsageSettled,
	type LeadScrapeMeteringService,
	refundLeadScrapeUsageIfReserved,
	reserveLeadScrapeUsage,
	reserveLeadScrapeUsageForExecution,
	settleLeadScrapeUsage,
} from "./lead-scrape-billing";

function buildMetering(status: AiUsageEvent["status"] = "reserved") {
	const event = {
		id: "usage-event-1",
		status,
	} as AiUsageEvent;
	const meteringService = {
		findByIdempotencyKey: vi.fn(async () => event),
		refund: vi.fn(async () => event),
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
	it("uses one stable attempt-scoped reservation across task runs", async () => {
		const { event, meteringService } = buildMetering();

		await expect(
			reserveLeadScrapeUsage(meteringService, {
				attemptId: "attempt-1",
				parentEventId: "chat-event-1",
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(event);
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"lead_scrape",
			{ actorUserId: "user-1" },
			{
				attemptRef: "attempt-1",
				credits: 500,
				idempotencyKey: "lead-scrape:attempt-1",
				parentEventId: "chat-event-1",
			},
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
				subject: { actorUserId: "user-1" },
			}),
		).rejects.toThrow(`cannot execute with ${status} metering`);
	});

	it("preserves the core rejection of a refunded reservation replay", async () => {
		const { meteringService } = buildMetering("refunded");

		await expect(
			reserveLeadScrapeUsage(meteringService, {
				attemptId: "attempt-1",
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
		const { meteringService } = buildMetering();
		vi.mocked(meteringService.findByIdempotencyKey).mockResolvedValueOnce(null);

		await expect(
			reserveLeadScrapeUsageForExecution(meteringService, {
				attemptId: "attempt-off",
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
				runtimeBillingDisabled: true,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(event);
		expect(meteringService.findByIdempotencyKey).not.toHaveBeenCalled();
		expect(meteringService.reserveWithReplay).toHaveBeenCalledOnce();
	});

	it("honors an off admission snapshot after the runtime switch turns on", async () => {
		const { meteringService } = buildMetering();
		vi.mocked(meteringService.findByIdempotencyKey).mockResolvedValueOnce(null);

		await expect(
			reserveLeadScrapeUsageForExecution(meteringService, {
				attemptId: "attempt-off",
				billingMode: "off",
				runtimeBillingDisabled: false,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBeNull();
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("settles the fixed price and repairs a reserved succeeded attempt", async () => {
		const { meteringService } = buildMetering();

		await expect(
			ensureLeadScrapeUsageSettled(meteringService, {
				attemptId: "attempt-1",
				resultCount: 27,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(true);
		expect(meteringService.findByIdempotencyKey).toHaveBeenCalledWith(
			"lead-scrape:attempt-1",
			{ actorUserId: "user-1" },
		);
		expect(meteringService.settle).toHaveBeenCalledWith("usage-event-1", {
			finalCredits: 500,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerOperation: 500,
				mode: "fixed",
				source: "operation_registry",
			},
			rawUsage: { provider: "serper", resultCount: 27 },
		});
	});

	it("does not retroactively charge a succeeded billing-off attempt", async () => {
		const { meteringService } = buildMetering();
		vi.mocked(meteringService.findByIdempotencyKey).mockResolvedValueOnce(null);

		await expect(
			ensureLeadScrapeUsageSettled(meteringService, {
				attemptId: "legacy-attempt",
				resultCount: 10,
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(false);
		expect(meteringService.settle).not.toHaveBeenCalled();
	});

	it("refunds only the matching event while it is still reserved", async () => {
		const reserved = buildMetering();

		await expect(
			refundLeadScrapeUsageIfReserved(reserved.meteringService, {
				attemptId: "attempt-1",
				eventId: "usage-event-1",
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(true);
		expect(reserved.meteringService.refund).toHaveBeenCalledWith(
			"usage-event-1",
			"lead_scrape_failed",
		);

		const settled = buildMetering("settled");
		await expect(
			refundLeadScrapeUsageIfReserved(settled.meteringService, {
				attemptId: "attempt-1",
				eventId: "usage-event-1",
				subject: { actorUserId: "user-1" },
			}),
		).resolves.toBe(false);
		expect(settled.meteringService.refund).not.toHaveBeenCalled();
	});

	it("exposes the same settlement for the main success path", async () => {
		const { meteringService } = buildMetering();

		await settleLeadScrapeUsage(meteringService, "usage-event-1", 3);

		expect(meteringService.settle).toHaveBeenCalledWith(
			"usage-event-1",
			expect.objectContaining({
				finalCredits: 500,
				rawUsage: { provider: "serper", resultCount: 3 },
			}),
		);
	});
});
