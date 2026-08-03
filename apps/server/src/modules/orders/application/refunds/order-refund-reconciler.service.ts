import { DOMAIN_FULFILLMENT_RECONCILIATION_STALE_MS } from "../../../domains/application/fulfillment/domain-fulfillment-reconciler.service";
import type { PaymentOrderRow } from "../../domain/payment-order.types";
import type { OrderRefundDispatcher } from "../../domain/ports/order-refund-dispatcher.port";
import { ORDER_REFUND_FAILURE_REASON_MAX_LENGTH } from "./order-refund.contracts";

export const ORDER_REFUND_RECONCILIATION_BATCH_SIZE = 100;
const DEFAULT_FAILURE_REASON = "Domain registration failed";

type RefundReconciliationOrder = Pick<
	PaymentOrderRow,
	| "fulfillmentError"
	| "id"
	| "kind"
	| "paidAt"
	| "providerPaymentIntentId"
	| "providerRefundId"
	| "status"
	| "updatedAt"
>;

export type OrderRefundReconcilerDependencies = {
	findDomainForUpdate(
		orderId: string,
		transaction: unknown,
	): Promise<{ id: string } | null>;
	findOrder(orderId: string): Promise<RefundReconciliationOrder | null>;
	findRefundReconciliationCandidates(input: {
		limit: number;
		staleBefore: Date;
	}): Promise<{ id: string }[]>;
	markOrderFailed(
		orderId: string,
		failureReason: string,
		transaction: unknown,
	): Promise<RefundReconciliationOrder | null>;
	now(): Date;
	recoverRefund: Pick<OrderRefundDispatcher, "recoverRefund">["recoverRefund"];
	withOrderFulfillmentFence<T>(
		orderId: string,
		operation: (
			order: RefundReconciliationOrder,
			transaction: unknown,
		) => Promise<T>,
	): Promise<T>;
};

export type OrderRefundReconciliationResult = {
	recovered: number;
	scanned: number;
};

export class OrderRefundReconcilerService {
	constructor(
		private readonly dependencies: OrderRefundReconcilerDependencies,
	) {}

	async execute(
		limit = ORDER_REFUND_RECONCILIATION_BATCH_SIZE,
	): Promise<OrderRefundReconciliationResult> {
		const boundedLimit = Math.min(
			ORDER_REFUND_RECONCILIATION_BATCH_SIZE,
			Math.max(1, Math.floor(limit)),
		);
		const staleBefore = new Date(
			this.dependencies.now().getTime() -
				DOMAIN_FULFILLMENT_RECONCILIATION_STALE_MS,
		);
		const candidates =
			await this.dependencies.findRefundReconciliationCandidates({
				limit: boundedLimit,
				staleBefore,
			});
		let recovered = 0;

		for (const candidate of candidates) {
			// Recheck after the scan and immediately before the adapter is allowed
			// to inspect/reset a canceled Trigger key. A concurrent refund wins.
			const current = await this.dependencies.findOrder(candidate.id);

			if (isEligibleFailedOrder(current)) {
				await this.dependencies.recoverRefund({
					failureReason: recoveryFailureReason(current.fulfillmentError),
					orderId: current.id,
				});
				recovered += 1;
				continue;
			}

			if (!isPotentiallyStrandedPaidOrder(current, staleBefore)) {
				continue;
			}

			const recoveredStrandedOrder = await this.recoverStrandedPaidOrder(
				current.id,
				staleBefore,
			);

			if (recoveredStrandedOrder) {
				recovered += 1;
			}
		}

		return { recovered, scanned: candidates.length };
	}

	private recoverStrandedPaidOrder(
		orderId: string,
		staleBefore: Date,
	): Promise<boolean> {
		return this.dependencies.withOrderFulfillmentFence(
			orderId,
			async (order, transaction) => {
				if (!isPotentiallyStrandedPaidOrder(order, staleBefore)) {
					return false;
				}

				// Domain creation takes this same fence before inserting the row. No
				// linked row therefore also proves there cannot be a live purchase run.
				const domain = await this.dependencies.findDomainForUpdate(
					order.id,
					transaction,
				);

				if (domain) {
					return false;
				}

				const failureReason = recoveryFailureReason(order.fulfillmentError);
				await this.dependencies.recoverRefund({
					failureReason,
					orderId: order.id,
				});
				const failed = await this.dependencies.markOrderFailed(
					order.id,
					failureReason,
					transaction,
				);

				if (!failed) {
					throw new Error(
						`Stranded payment order ${order.id} could not be marked failed after refund dispatch`,
					);
				}

				return true;
			},
		);
	}
}

function isEligibleFailedOrder(
	order: RefundReconciliationOrder | null,
): order is RefundReconciliationOrder & { status: "failed" } {
	return Boolean(
		order &&
			order.kind === "domain_registration" &&
			order.status === "failed" &&
			order.paidAt !== null &&
			order.providerPaymentIntentId !== null &&
			order.providerRefundId === null,
	);
}

function isPotentiallyStrandedPaidOrder(
	order: RefundReconciliationOrder | null,
	staleBefore: Date,
): order is RefundReconciliationOrder & { status: "paid" } {
	return Boolean(
		order &&
			order.kind === "domain_registration" &&
			order.status === "paid" &&
			order.paidAt !== null &&
			order.providerPaymentIntentId !== null &&
			order.providerRefundId === null &&
			order.updatedAt.getTime() <= staleBefore.getTime(),
	);
}

function recoveryFailureReason(failureReason: string | null): string {
	if (!failureReason || failureReason.trim().length === 0) {
		return DEFAULT_FAILURE_REASON;
	}

	return failureReason.slice(0, ORDER_REFUND_FAILURE_REASON_MAX_LENGTH);
}
