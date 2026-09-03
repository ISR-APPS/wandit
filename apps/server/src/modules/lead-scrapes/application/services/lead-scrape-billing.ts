import { env } from "@wandit/env/server";

import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import type { BillingAdmissionMode } from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type {
	AiUsageEvent,
	DirectMeteringSettlement,
} from "../../../metering/domain/metering";
import {
	LEAD_SCRAPE_CREDITS_PER_LEAD,
	LEAD_SCRAPE_MINIMUM_CREDITS,
	leadScrapeCredits,
} from "../../../metering/domain/operation-registry";
import { serperEvidenceKey } from "../../../metering/domain/provider-call-evidence";

export type LeadScrapeMeteringService = Pick<
	MeteringService,
	| "captureProviderCallEvidence"
	| "findByIdempotencyKey"
	| "listProviderCallEvidence"
	| "refund"
	| "refundWithProviderCost"
	| "reserveWithReplay"
	| "settle"
	| "settleProviderCallEvidenceCost"
>;

export type LeadScrapeSettlementInput = {
	/** Rows delivered to the user (the product price is per delivered lead). */
	deliveredLeads: number;
	/** Serper pages fetched — the recorded provider cost, never the price. */
	serperPages: number;
};

export function leadScrapeMeteringKey(attemptId: string): string {
	return `lead-scrape:${attemptId}`;
}

/** Serper provider spend for `pages` Maps page requests, in USD micros. */
export function serperCostUsdMicros(pages: number): number {
	if (!Number.isSafeInteger(pages) || pages < 0) {
		throw new Error("Serper page count must be a non-negative integer");
	}

	return pages * serperUsdMicrosPerSearch();
}

/** Serper contract rate per Maps page, in USD micros (env default 1000). */
export function serperUsdMicrosPerSearch(): number {
	// The ?? repeats the env default because SKIP_ENV_VALIDATION (tests)
	// bypasses zod defaults and leaves the value undefined.
	return env.SERPER_USD_MICROS_PER_SEARCH ?? 1000;
}

/**
 * ONE durable Serper receipt per scrape attempt: inserted on the first page,
 * then raised monotonically to the final page count. Contract-rate priced,
 * never customer-billable (the user pays the per-lead product price). The
 * event-level Serper cost (settle snapshot / refund-with-cost) uses the same
 * formula, so both readings agree; admin spend reads the evidence row.
 * Best-effort: a bookkeeping failure must never fail the scrape.
 */
export async function recordSerperEvidence(
	meteringService: Pick<
		LeadScrapeMeteringService,
		"captureProviderCallEvidence" | "settleProviderCallEvidenceCost"
	>,
	input: { attemptId: string; eventId: string; pages: number },
): Promise<void> {
	if (!Number.isSafeInteger(input.pages) || input.pages <= 0) {
		return;
	}

	const rate = serperUsdMicrosPerSearch();
	const cost = {
		chargedUsdMicros: input.pages * rate,
		costSource: "serper_contract_env",
		costStatus: "contract_rate" as const,
		rateUsdMicrosPerUnit: rate,
	};
	const evidence = await meteringService.captureProviderCallEvidence(
		input.eventId,
		{
			...cost,
			customerBillable: false,
			idempotencyKey: serperEvidenceKey(input.attemptId),
			providerRequestId: input.attemptId,
			transport: "serper",
			unitKind: "search_page",
			units: input.pages,
		},
	);

	if (evidence.units < input.pages) {
		await meteringService.settleProviderCallEvidenceCost(evidence.id, {
			...cost,
			units: input.pages,
		});
	}
}

export async function reserveLeadScrapeUsage(
	meteringService: LeadScrapeMeteringService,
	input: {
		attemptId: string;
		parentEventId?: string;
		/** Leads the user asked for; the hold prices them at the per-lead rate. */
		requestedLimit: number;
		subject: MeteringSubject;
	},
): Promise<AiUsageEvent> {
	const key = leadScrapeMeteringKey(input.attemptId);
	// A replay (Trigger run after the chat-tool reserve, or a retry of a hold
	// created before per-lead pricing) reuses the durable hold's own size.
	const existing = await meteringService.findByIdempotencyKey(
		key,
		input.subject,
	);
	const reservation = await meteringService.reserveWithReplay(
		"lead_scrape",
		input.subject,
		{
			attemptRef: input.attemptId,
			credits: existing
				? existing.reservedCredits
				: leadScrapeCredits(input.requestedLimit),
			idempotencyKey: key,
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
		requestedLimit: number;
		runtimeBillingDisabled: boolean;
		subject: MeteringSubject;
	},
): Promise<AiUsageEvent | null> {
	const billingDisabled =
		input.billingMode === "off" ||
		(input.billingMode === undefined && input.runtimeBillingDisabled);

	if (billingDisabled) {
		const existing = await meteringService.findByIdempotencyKey(
			leadScrapeMeteringKey(input.attemptId),
			input.subject,
		);

		if (!existing) {
			return null;
		}
	}

	return reserveLeadScrapeUsage(meteringService, input);
}

export async function settleLeadScrapeUsage(
	meteringService: LeadScrapeMeteringService,
	event: Pick<AiUsageEvent, "id" | "pricingSnapshot">,
	input: LeadScrapeSettlementInput,
): Promise<void> {
	await meteringService.settle(event.id, leadScrapeSettlement(event, input));
}

/**
 * Repair the old success-before-settlement crash window on duplicate task
 * delivery. Missing events are legacy/billing-off successes and are not
 * charged retroactively. An event that already left `reserved` is a durable
 * billing fact: return without touching it — a settle replay with a guessed
 * page count would conflict with the recorded settlement, never match it.
 * Only a still-reserved hold is settled, with the page count read from the
 * durable Serper evidence row of the original run (0 when none was written).
 */
export async function ensureLeadScrapeUsageSettled(
	meteringService: LeadScrapeMeteringService,
	input: {
		attemptId: string;
		deliveredLeads: number;
		subject: MeteringSubject;
	},
): Promise<boolean> {
	const event = await meteringService.findByIdempotencyKey(
		leadScrapeMeteringKey(input.attemptId),
		input.subject,
	);

	if (!event) {
		return false;
	}

	if (event.status !== "reserved") {
		return true;
	}

	const serperPages = await recordedSerperPages(meteringService, {
		attemptId: input.attemptId,
		eventId: event.id,
	});

	await settleLeadScrapeUsage(meteringService, event, {
		deliveredLeads: input.deliveredLeads,
		serperPages,
	});
	return true;
}

/** Pages the attempt's durable Serper receipt recorded, else 0. */
async function recordedSerperPages(
	meteringService: Pick<LeadScrapeMeteringService, "listProviderCallEvidence">,
	input: { attemptId: string; eventId: string },
): Promise<number> {
	const key = serperEvidenceKey(input.attemptId);
	const evidence = await meteringService.listProviderCallEvidence(
		input.eventId,
	);
	const receipt = evidence.find((row) => row.idempotencyKey === key);

	return receipt && Number.isSafeInteger(receipt.units) && receipt.units > 0
		? receipt.units
		: 0;
}

/**
 * Ruling 6: a failed scrape refunds the user fully, while the Serper pages it
 * consumed are still recorded as provider cost on the event.
 */
export async function refundLeadScrapeUsageIfReserved(
	meteringService: LeadScrapeMeteringService,
	input: {
		attemptId: string;
		eventId: string;
		serperPages: number;
		subject: MeteringSubject;
	},
): Promise<boolean> {
	const event = await meteringService.findByIdempotencyKey(
		leadScrapeMeteringKey(input.attemptId),
		input.subject,
	);

	if (event?.id !== input.eventId || event.status !== "reserved") {
		return false;
	}

	await meteringService.refundWithProviderCost(
		event.id,
		serperCostUsdMicros(input.serperPages),
		"lead_scrape_failed",
	);
	return true;
}

function leadScrapeSettlement(
	event: Pick<AiUsageEvent, "pricingSnapshot">,
	input: LeadScrapeSettlementInput,
): DirectMeteringSettlement {
	if (!Number.isSafeInteger(input.deliveredLeads) || input.deliveredLeads < 0) {
		throw new Error("Delivered lead count must be a non-negative integer");
	}

	const costUsdMicros = serperCostUsdMicros(input.serperPages);
	const legacy = legacyPerOperationCredits(event.pricingSnapshot);

	// A hold admitted under the retired flat price settles under that price.
	if (legacy !== null) {
		return {
			costUsdMicros,
			finalCredits: legacy,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerOperation: legacy,
				creditsPerUnit: legacy,
				mode: "fixed",
				operation: "lead_scrape",
				source: "operation_registry",
				unit: "operation",
				units: 1,
			},
			rawUsage: {
				provider: "serper",
				resultCount: input.deliveredLeads,
				serperPages: input.serperPages,
			},
		};
	}

	return {
		costUsdMicros,
		finalCredits: leadScrapeCredits(input.deliveredLeads),
		pricing: "direct",
		pricingSnapshot: {
			creditsPerUnit: LEAD_SCRAPE_CREDITS_PER_LEAD,
			minimumCredits: LEAD_SCRAPE_MINIMUM_CREDITS,
			mode: "fixed",
			operation: "lead_scrape",
			source: "operation_registry",
			unit: "lead",
			units: input.deliveredLeads,
		},
		rawUsage: {
			provider: "serper",
			resultCount: input.deliveredLeads,
			serperPages: input.serperPages,
		},
	};
}

/** Flat per-operation price of a pre-per-lead reservation snapshot, else null. */
function legacyPerOperationCredits(pricingSnapshot: unknown): number | null {
	if (
		typeof pricingSnapshot !== "object" ||
		pricingSnapshot === null ||
		Array.isArray(pricingSnapshot)
	) {
		return null;
	}

	const snapshot = pricingSnapshot as Record<string, unknown>;

	if (
		snapshot.source !== "operation_registry_reservation" ||
		snapshot.mode !== "fixed" ||
		snapshot.unit !== "operation" ||
		!Number.isSafeInteger(snapshot.creditsPerUnit) ||
		(snapshot.creditsPerUnit as number) <= 0
	) {
		return null;
	}

	return snapshot.creditsPerUnit as number;
}
