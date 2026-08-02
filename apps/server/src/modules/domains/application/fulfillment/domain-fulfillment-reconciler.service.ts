import type { DomainStatus, PaymentOrderStatus } from "@wandit/contracts";

import type { DomainPurchasePayload } from "./domain-fulfillment.contracts";

export const DOMAIN_FULFILLMENT_RECONCILIATION_STALE_MS = 30 * 60_000;
export const DOMAIN_FULFILLMENT_RECONCILIATION_BATCH_SIZE = 100;

export type DomainFulfillmentReconciliationCandidate = {
	domainId: string;
	domainStatus: DomainStatus;
	orderId: string;
	orderStatus: PaymentOrderStatus;
	updatedAt: Date;
};

export type DomainFulfillmentReconcilerDependencies = {
	findStalePurchaseCandidates(input: {
		limit: number;
		staleBefore: Date;
	}): Promise<readonly DomainFulfillmentReconciliationCandidate[]>;
	now(): Date;
	recoverPurchase(payload: DomainPurchasePayload): Promise<{ id: string }>;
};

export type DomainFulfillmentReconciliationResult = {
	ensured: number;
	processed: true;
	scanned: number;
	skipped: number;
};

/**
 * DB-driven backstop for lost, canceled, or terminal Trigger handoffs. The
 * dispatcher owns run inspection and key reset; this service owns only the
 * bounded stale-row policy and a final defensive eligibility check.
 */
export class DomainFulfillmentReconcilerService {
	constructor(
		private readonly dependencies: DomainFulfillmentReconcilerDependencies,
	) {}

	async execute(): Promise<DomainFulfillmentReconciliationResult> {
		const now = this.dependencies.now();
		const staleBefore = new Date(
			now.getTime() - DOMAIN_FULFILLMENT_RECONCILIATION_STALE_MS,
		);
		const candidates = await this.dependencies.findStalePurchaseCandidates({
			limit: DOMAIN_FULFILLMENT_RECONCILIATION_BATCH_SIZE,
			staleBefore,
		});
		const result: DomainFulfillmentReconciliationResult = {
			ensured: 0,
			processed: true,
			scanned: candidates.length,
			skipped: 0,
		};

		for (const candidate of candidates) {
			if (!isEligibleCandidate(candidate, staleBefore)) {
				result.skipped += 1;
				continue;
			}

			await this.dependencies.recoverPurchase({
				domainId: candidate.domainId,
				orderId: candidate.orderId,
			});
			result.ensured += 1;
		}

		return result;
	}
}

function isEligibleCandidate(
	candidate: DomainFulfillmentReconciliationCandidate,
	staleBefore: Date,
): boolean {
	if (
		candidate.updatedAt.getTime() > staleBefore.getTime() ||
		candidate.domainId.length === 0 ||
		candidate.orderId.length === 0
	) {
		return false;
	}

	if (candidate.domainStatus === "active") {
		return candidate.orderStatus === "fulfilling";
	}

	return (
		(candidate.domainStatus === "registering" ||
			candidate.domainStatus === "configuring") &&
		(candidate.orderStatus === "paid" || candidate.orderStatus === "fulfilling")
	);
}
