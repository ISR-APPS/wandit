import type { PaymentOrder, PaymentOrderStatus } from "@wandit/contracts";

import type { BillingReturnCopy } from "./billing-return-copy";

export type RefundAwarePaymentOrder = PaymentOrder & {
	refundStatus?: string | null;
};

export type OrderReturnState = {
	body: string;
	title: string;
	tone: "error" | "progress" | "success" | "warning";
};

const PENDING_REFUND_STATUSES = new Set([
	"pending",
	"refund_pending",
	"requires_action",
]);

export function getOrderRefundStatus(
	order: RefundAwarePaymentOrder,
): string | null {
	return order.refundStatus ?? null;
}

export function isOrderLifecycleTerminal(status: PaymentOrderStatus): boolean {
	return (
		status === "fulfilled" ||
		status === "refunded" ||
		status === "canceled" ||
		status === "failed"
	);
}

export function shouldPollOrder(order: RefundAwarePaymentOrder): boolean {
	if (
		order.status === "pending" ||
		order.status === "paid" ||
		order.status === "fulfilling"
	) {
		return true;
	}

	if (order.status !== "failed") {
		return false;
	}

	const refundStatus = getOrderRefundStatus(order);

	if (refundStatus === null) {
		/*
		 * Captured failures persist their durable refund job before committing the
		 * failed order. The page can win the race against that worker and briefly
		 * see no refund status, so paidAt is the public-contract discriminator from
		 * an unpaid asynchronous checkout failure, which is already terminal.
		 */
		return order.paidAt !== null;
	}

	return (
		PENDING_REFUND_STATUSES.has(refundStatus) || refundStatus === "succeeded"
	);
}

export function orderReturnStateFor(
	order: RefundAwarePaymentOrder,
	copy: BillingReturnCopy["order"],
): OrderReturnState {
	switch (order.status) {
		case "fulfilled":
			return {
				body: copy.fulfilledBody,
				title: copy.fulfilledTitle,
				tone: "success",
			};
		case "refunded":
			return {
				body: copy.refundedBody,
				title: copy.refundedTitle,
				tone: "error",
			};
		case "canceled":
			return {
				body: copy.canceledBody,
				title: copy.canceledTitle,
				tone: "error",
			};
		case "failed": {
			const refundStatus = getOrderRefundStatus(order);

			if (refundStatus === null && order.paidAt !== null) {
				return {
					body: copy.refundPendingBody,
					title: copy.refundPendingTitle,
					tone: "warning",
				};
			}

			if (refundStatus === "succeeded") {
				return {
					body: copy.refundedBody,
					title: copy.refundedTitle,
					tone: "error",
				};
			}

			if (refundStatus && PENDING_REFUND_STATUSES.has(refundStatus)) {
				return {
					body: copy.refundPendingBody,
					title: copy.refundPendingTitle,
					tone: "warning",
				};
			}

			if (refundStatus) {
				return {
					body: copy.refundProblemBody,
					title: copy.refundProblemTitle,
					tone: "error",
				};
			}

			return {
				body: copy.failedBody,
				title: copy.failedTitle,
				tone: "error",
			};
		}
		case "paid":
		case "fulfilling":
			return {
				body: copy.paidBody,
				title: copy.paidTitle,
				tone: "progress",
			};
		default:
			return {
				body: copy.pendingBody,
				title: copy.pendingTitle,
				tone: "progress",
			};
	}
}
