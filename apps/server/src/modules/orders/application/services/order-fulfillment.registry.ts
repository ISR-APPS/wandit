import { Inject, Injectable } from "@nestjs/common";
import type { PaymentOrderKind } from "@wandit/contracts";

import { OrderInvariantViolationError } from "../../domain/errors/payment-order.errors";
import {
	ORDER_FULFILLMENT_HANDLERS,
	type OrderFulfillmentHandler,
} from "../../domain/ports/order-fulfillment.port";

@Injectable()
export class OrderFulfillmentRegistry {
	private readonly byKind = new Map<
		PaymentOrderKind,
		OrderFulfillmentHandler
	>();

	constructor(
		@Inject(ORDER_FULFILLMENT_HANDLERS)
		handlers: OrderFulfillmentHandler[],
	) {
		for (const handler of handlers) {
			if (this.byKind.has(handler.kind)) {
				throw new Error(
					`Duplicate payment-order fulfillment handler for ${handler.kind}`,
				);
			}
			this.byKind.set(handler.kind, handler);
		}
	}

	forKind(kind: PaymentOrderKind): OrderFulfillmentHandler {
		const handler = this.byKind.get(kind);

		if (!handler) {
			throw new OrderInvariantViolationError(
				`No fulfillment handler is registered for order kind ${kind}`,
			);
		}

		return handler;
	}
}
