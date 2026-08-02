import type {
	DomainFulfillmentRow,
	DomainPurchasePayload,
} from "./domain-fulfillment.contracts";
import { TerminalDomainFulfillmentError } from "./domain-fulfillment.errors";

type DomainTerminalFailureExecutor = {
	execute(
		row: DomainFulfillmentRow,
		error: unknown,
		options?: { orderId: string | null },
	): Promise<unknown>;
};

type DomainPurchaseFailureFinalizerDependencies = {
	findDomain(domainId: string): Promise<DomainFulfillmentRow | null>;
	terminalFailure: DomainTerminalFailureExecutor;
};

export type DomainTerminalFailureContext = {
	error: unknown;
	orderId: string | null;
};

/**
 * Rebuild the persisted terminal error and keep money recovery tied to the
 * row's real order, even when a stale task payload names a different order.
 */
export function domainTerminalFailureContext(
	row: DomainFulfillmentRow,
	error: unknown,
): DomainTerminalFailureContext {
	return {
		error:
			row.status === "failed"
				? new TerminalDomainFulfillmentError(
						row.error ?? "Domain registration failed",
					)
				: error,
		orderId: row.paymentOrderId,
	};
}

export class DomainPurchaseFailureFinalizer {
	constructor(
		private readonly dependencies: DomainPurchaseFailureFinalizerDependencies,
	) {}

	async execute(payload: DomainPurchasePayload, error: unknown) {
		const row = await this.dependencies.findDomain(payload.domainId);

		if (!row) {
			return { status: "unchanged" as const };
		}

		const terminal = domainTerminalFailureContext(row, error);

		return this.dependencies.terminalFailure.execute(row, terminal.error, {
			orderId: terminal.orderId,
		});
	}
}
