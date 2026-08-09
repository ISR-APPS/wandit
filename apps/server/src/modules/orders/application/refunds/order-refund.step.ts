import type { PaymentOrderRow } from "../../domain/payment-order.types";

type RefundableOrder = Pick<
	PaymentOrderRow,
	"id" | "providerPaymentIntentId" | "status"
>;

export interface OrderRefundOrderStore {
	findById(orderId: string): Promise<RefundableOrder | null>;
	markFailed(
		orderId: string,
		failureReason: string,
	): Promise<RefundableOrder | null>;
}

export interface OrderRefundPaymentProvider {
	createRefund(input: {
		idempotencyKey: string;
		paymentIntentId: string;
	}): Promise<unknown>;
}

export interface OrderRefundStateUpdater {
	updateRefundStatus(input: {
		paymentIntentId: string | null;
		providerRefundId: string;
		refundStatus: string | null;
	}): Promise<boolean>;
}

export class OrderRefundInvariantViolationError extends Error {
	readonly code = "ORDER_INVARIANT_VIOLATION";

	constructor(message: string) {
		super(message);
		this.name = "OrderRefundInvariantViolationError";
	}
}

export class OrderRefundStep {
	constructor(
		private readonly orderStore: OrderRefundOrderStore,
		private readonly paymentProvider: OrderRefundPaymentProvider,
		private readonly refundStateUpdater: OrderRefundStateUpdater,
	) {}

	async execute(orderId: string, failureReason: string): Promise<boolean> {
		const initial = await this.orderStore.findById(orderId);

		if (!initial) {
			throw new OrderRefundInvariantViolationError(
				`Payment order ${orderId} not found for refund`,
			);
		}

		const order = await this.ensureFailed(initial, failureReason);

		if (!order) {
			return false;
		}

		if (!order.providerPaymentIntentId) {
			throw new OrderRefundInvariantViolationError(
				`Failed payment order ${order.id} has no payment intent`,
			);
		}

		const refund = await this.paymentProvider.createRefund({
			idempotencyKey: `order-refund:${order.id}`,
			paymentIntentId: order.providerPaymentIntentId,
		});

		if (!isRefundResult(refund)) {
			throw new OrderRefundInvariantViolationError(
				`Stripe returned an invalid refund for payment order ${order.id}`,
			);
		}

		const updated = await this.refundStateUpdater.updateRefundStatus({
			paymentIntentId: order.providerPaymentIntentId,
			providerRefundId: refund.id,
			refundStatus: refund.status,
		});

		if (!updated) {
			throw new OrderRefundInvariantViolationError(
				`Stripe refund ${refund.id} could not reconcile payment order ${order.id}`,
			);
		}

		return true;
	}

	private async ensureFailed(
		order: RefundableOrder,
		failureReason: string,
	): Promise<RefundableOrder | null> {
		if (order.status === "failed") {
			return order;
		}

		if (order.status !== "paid" && order.status !== "fulfilling") {
			return null;
		}

		const failed = await this.orderStore.markFailed(order.id, failureReason);

		if (failed) {
			return failed;
		}

		const current = await this.orderStore.findById(order.id);

		return current?.status === "failed" ? current : null;
	}
}

function isRefundResult(
	value: unknown,
): value is { id: string; status: string | null } {
	if (!value) {
		return false;
	}

	const refund = value as { id?: unknown; status?: unknown };

	return (
		typeof refund.id === "string" &&
		(typeof refund.status === "string" || refund.status === null)
	);
}
