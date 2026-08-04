import { type Queue, queue } from "@trigger.dev/sdk";

/**
 * Serializes credit, subscription, webhook, and affiliate maintenance. The
 * database remains the source of truth (CAS/advisory locks still apply), while
 * this boundary prevents scheduled and on-demand financial runs from creating
 * avoidable lock contention.
 */
export const billingFinancialQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "billing-financial-maintenance",
});

/** One batch run owns metering reconciliation/recovery at a time. */
export const meteringMaintenanceQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "metering-maintenance",
});

/** Price refreshes neither block nor race customer-ledger maintenance. */
export const modelPricingQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "model-pricing-maintenance",
});
