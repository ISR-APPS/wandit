import type { DomainStatus } from "@wandit/contracts";

import {
	bestEffortDeleteCustomerZone,
	bestEffortDeleteCustomHostname,
	bestEffortDeleteDomainPointer,
} from "./domain-assets-cleanup";
import type {
	DomainFulfillmentLogger,
	DomainFulfillmentOrder,
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";
import {
	domainFailureSummary,
	MissingDomainPaymentOrderError,
} from "./domain-fulfillment.errors";

export type DomainTerminalFailureResult = {
	status: "active" | "failed" | "unchanged";
};

export type DomainTerminalFailureErrorTags = {
	domainId: string;
	orderId: string;
};

type DomainTerminalFailureDependencies = {
	deleteCustomHostname(id: string): Promise<void>;
	deleteDomainPointer(name: string): Promise<void>;
	deleteZone(id: string): Promise<void>;
	dispatchRefund(orderId: string, failureReason: string): Promise<void>;
	findDomainForUpdate(
		orderId: string,
		transaction: unknown,
	): Promise<DomainFulfillmentRow | null>;
	logger: DomainFulfillmentLogger;
	markDomainFailed(
		domainId: string,
		summary: string,
	): Promise<DomainFulfillmentRow>;
	markOrderFailed(
		orderId: string,
		summary: string,
		transaction: unknown,
	): Promise<DomainFulfillmentOrder | null>;
	markOrderFulfilled(orderId: string): Promise<unknown>;
	reportError(error: unknown, tags: DomainTerminalFailureErrorTags): void;
	updateDomainIfStatus(
		domainId: string,
		statuses: DomainStatus[],
		patch: DomainFulfillmentPatch,
		transaction: unknown,
	): Promise<DomainFulfillmentRow | null>;
	withOrderFulfillmentFence<T>(
		orderId: string,
		operation: (
			order: DomainFulfillmentOrder,
			transaction: unknown,
		) => Promise<T>,
	): Promise<T>;
};

export class DomainTerminalFailureStep {
	constructor(
		private readonly dependencies: DomainTerminalFailureDependencies,
	) {}

	async execute(
		row: DomainFulfillmentRow,
		error: unknown,
		options?: { orderId: string | null },
	): Promise<DomainTerminalFailureResult> {
		const orderId = options ? options.orderId : row.paymentOrderId;
		const failure = domainFailureSummary(error);

		if (!orderId) {
			if (row.status === "registering" || row.status === "configuring") {
				this.reportError(row.id, null, error);
			}

			if (error instanceof MissingDomainPaymentOrderError) {
				await this.failMissingOrder(row, failure);
			} else {
				await this.failWithoutOrder(row, failure);
			}

			return { status: "failed" };
		}

		const current = await this.dependencies.withOrderFulfillmentFence(
			orderId,
			async (order, transaction) => {
				const lockedDomain = await this.dependencies.findDomainForUpdate(
					orderId,
					transaction,
				);

				if (!lockedDomain || lockedDomain.id !== row.id) {
					throw new Error(
						`Payment order ${orderId} has no matching domain ${row.id}`,
					);
				}

				if (lockedDomain.status === "active" || order.status === "fulfilled") {
					return lockedDomain;
				}

				if (
					lockedDomain.status === "registering" ||
					lockedDomain.status === "configuring"
				) {
					this.reportError(lockedDomain.id, orderId, error);
				}

				const needsRefund =
					order.status === "paid" ||
					order.status === "fulfilling" ||
					order.status === "failed";

				if (needsRefund) {
					await this.dependencies.dispatchRefund(orderId, failure);
				}

				const failedDomain =
					lockedDomain.status === "failed"
						? lockedDomain
						: await this.dependencies.updateDomainIfStatus(
								lockedDomain.id,
								["registering", "configuring"],
								{ error: failure, isPrimary: false, status: "failed" },
								transaction,
							);

				if (
					needsRefund &&
					(order.status === "paid" || order.status === "fulfilling")
				) {
					await this.dependencies.markOrderFailed(
						orderId,
						failure,
						transaction,
					);
				}

				return failedDomain ?? lockedDomain;
			},
		);

		if (current.status === "active") {
			await this.dependencies.markOrderFulfilled(orderId);

			return { status: "active" };
		}

		if (current.status !== "failed") {
			return { status: "unchanged" };
		}

		await bestEffortDeleteCustomHostname(current, this.dependencies);
		await bestEffortDeleteCustomerZone(current, this.dependencies);
		await bestEffortDeleteDomainPointer(current, this.dependencies);

		return { status: "failed" };
	}

	private reportError(
		domainId: string,
		orderId: string | null,
		error: unknown,
	): void {
		// Terminal failures complete normally after storing a sanitized summary,
		// so this is the only report point for the original provider error. Failed
		// row replays from Trigger onFailure are guarded before reaching this call.
		this.dependencies.reportError(error, {
			domainId,
			orderId: orderId ?? "none",
		});
	}

	private async failMissingOrder(
		row: DomainFulfillmentRow,
		failure: string,
	): Promise<void> {
		await bestEffortDeleteCustomHostname(row, this.dependencies);
		await bestEffortDeleteCustomerZone(row, this.dependencies);
		await this.dependencies.markDomainFailed(row.id, failure);
	}

	private async failWithoutOrder(
		row: DomainFulfillmentRow,
		failure: string,
	): Promise<void> {
		this.dependencies.logger.warn(
			`Domain ${row.id} failed terminally with no payment order attached; nothing to refund`,
		);
		await bestEffortDeleteCustomHostname(row, this.dependencies);
		await bestEffortDeleteCustomerZone(row, this.dependencies);
		await bestEffortDeleteDomainPointer(row, this.dependencies);
		await this.dependencies.markDomainFailed(row.id, failure);
	}
}
