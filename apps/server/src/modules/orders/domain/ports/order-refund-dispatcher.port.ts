import type { OrderRefundPayload } from "../../application/refunds/order-refund.contracts";

export const ORDER_REFUND_DISPATCHER = Symbol("ORDER_REFUND_DISPATCHER");

export type OrderRefundTaskHandle = {
	id: string;
};

/**
 * Durable refund-task handoff. The recovery method is reserved for the
 * DB-backed reconciler so normal producers can never reset a terminal run.
 */
export interface OrderRefundDispatcher {
	assertAvailable(): void;
	recoverRefund(payload: OrderRefundPayload): Promise<OrderRefundTaskHandle>;
	triggerRefund(payload: OrderRefundPayload): Promise<OrderRefundTaskHandle>;
}
