import type { PaymentOrderKind } from "@wandit/contracts";

import type { PaymentOrderRow } from "../payment-order.types";

export const ORDER_FULFILLMENT_HANDLERS = Symbol("ORDER_FULFILLMENT_HANDLERS");

export interface OrderFulfillmentHandler {
	readonly kind: PaymentOrderKind;
	fulfill(order: PaymentOrderRow): Promise<void>;
	onPaymentFailed?(order: PaymentOrderRow): Promise<void>;
}
