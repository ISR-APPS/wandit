import { type Queue, queue } from "@trigger.dev/sdk";

/**
 * Shared registrar/domain boundary. Checkpointed waits release this slot, while
 * registrar sync and registration still cannot overlap.
 */
export const domainOperationsQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "domain-operations",
});

/** Independent financial-recovery boundary, matching the legacy refund worker. */
export const orderRefundsQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "order-refunds",
});
