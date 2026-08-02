import type { BillingAdmissionMode } from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type {
	AiUsageEvent,
	DirectMeteringSettlement,
} from "../../../metering/domain/metering";
import { fixedOperationCredits } from "../../../metering/domain/operation-registry";

export type LeadScrapeMeteringService = Pick<
	MeteringService,
	"findByIdempotencyKey" | "refund" | "reserveWithReplay" | "settle"
>;

export function leadScrapeMeteringKey(attemptId: string): string {
	return `lead-scrape:${attemptId}`;
}

export async function reserveLeadScrapeUsage(
	meteringService: LeadScrapeMeteringService,
	input: {
		attemptId: string;
		parentEventId?: string;
		userId: string;
	},
): Promise<AiUsageEvent> {
	const reservation = await meteringService.reserveWithReplay(
		"lead_scrape",
		input.userId,
		{
			attemptRef: input.attemptId,
			credits: fixedOperationCredits("lead_scrape"),
			idempotencyKey: leadScrapeMeteringKey(input.attemptId),
			parentEventId: input.parentEventId,
		},
	);

	// A retry may reuse an open hold left by a crashed run, but terminal
	// financial events must never authorize another paid provider operation.
	if (reservation.event.status !== "reserved") {
		throw new Error(
			`Lead scrape ${input.attemptId} cannot execute with ${reservation.event.status} metering`,
		);
	}

	return reservation.event;
}

/**
 * Trigger execution honors a hold created by the chat tool even if an operator
 * flips billing off after admission. With no prior hold, billing-off remains a
 * true bypass and this read path cannot create a financial event.
 */
export async function reserveLeadScrapeUsageForExecution(
	meteringService: LeadScrapeMeteringService,
	input: {
		attemptId: string;
		billingMode?: BillingAdmissionMode;
		parentEventId?: string;
		runtimeBillingDisabled: boolean;
		userId: string;
	},
): Promise<AiUsageEvent | null> {
	const billingDisabled =
		input.billingMode === "off" ||
		(input.billingMode === undefined && input.runtimeBillingDisabled);

	if (billingDisabled) {
		const existing = await meteringService.findByIdempotencyKey(
			leadScrapeMeteringKey(input.attemptId),
			input.userId,
		);

		if (!existing) {
			return null;
		}
	}

	return reserveLeadScrapeUsage(meteringService, input);
}

export async function settleLeadScrapeUsage(
	meteringService: LeadScrapeMeteringService,
	eventId: string,
	resultCount: number,
): Promise<void> {
	await meteringService.settle(eventId, leadScrapeSettlement(resultCount));
}

/**
 * Repair the old success-before-settlement crash window on duplicate task
 * delivery. Missing events are legacy/billing-off successes and are not
 * charged retroactively.
 */
export async function ensureLeadScrapeUsageSettled(
	meteringService: LeadScrapeMeteringService,
	input: { attemptId: string; resultCount: number; userId: string },
): Promise<boolean> {
	const event = await meteringService.findByIdempotencyKey(
		leadScrapeMeteringKey(input.attemptId),
		input.userId,
	);

	if (!event) {
		return false;
	}

	await settleLeadScrapeUsage(meteringService, event.id, input.resultCount);
	return true;
}

export async function refundLeadScrapeUsageIfReserved(
	meteringService: LeadScrapeMeteringService,
	input: { attemptId: string; eventId: string; userId: string },
): Promise<boolean> {
	const event = await meteringService.findByIdempotencyKey(
		leadScrapeMeteringKey(input.attemptId),
		input.userId,
	);

	if (event?.id !== input.eventId || event.status !== "reserved") {
		return false;
	}

	await meteringService.refund(event.id, "lead_scrape_failed");
	return true;
}

function leadScrapeSettlement(resultCount: number): DirectMeteringSettlement {
	return {
		finalCredits: fixedOperationCredits("lead_scrape"),
		pricing: "direct",
		pricingSnapshot: {
			creditsPerOperation: fixedOperationCredits("lead_scrape"),
			mode: "fixed",
			source: "operation_registry",
		},
		rawUsage: {
			provider: "serper",
			resultCount,
		},
	};
}
