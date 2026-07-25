import { Inject, Injectable } from "@nestjs/common";

import {
	PAYMENT_PROVIDER,
	type PaymentProvider,
} from "../../../billing/domain/ports/payment-provider.port";
import { OrderInvariantViolationError } from "../../domain/errors/payment-order.errors";
import type { PaymentOrderRow } from "../../domain/payment-order.types";
import { PaymentOrdersRepository } from "../../infrastructure/persistence/payment-orders.repository";
import { OrderRefundsService } from "./order-refunds.service";

@Injectable()
export class OrderRefundExecutorService {
	constructor(
		@Inject(PaymentOrdersRepository)
		private readonly paymentOrdersRepository: PaymentOrdersRepository,
		@Inject(PAYMENT_PROVIDER)
		private readonly paymentProvider: PaymentProvider,
		@Inject(OrderRefundsService)
		private readonly orderRefundsService: OrderRefundsService,
	) {}

	async execute(orderId: string, failureReason: string): Promise<boolean> {
		const initial = await this.paymentOrdersRepository.findById(orderId);

		if (!initial) {
			throw new OrderInvariantViolationError(
				`Payment order ${orderId} not found for refund`,
			);
		}

		const order = await this.ensureFailed(initial, failureReason);

		if (!order) {
			return false;
		}

		if (!order.providerPaymentIntentId) {
			throw new OrderInvariantViolationError(
				`Failed payment order ${order.id} has no payment intent`,
			);
		}

		const refund = await this.paymentProvider.createRefund({
			idempotencyKey: `order-refund:${order.id}`,
			paymentIntentId: order.providerPaymentIntentId,
		});

		if (
			!refund ||
			typeof refund.id !== "string" ||
			(typeof refund.status !== "string" && refund.status !== null)
		) {
			throw new OrderInvariantViolationError(
				`Stripe returned an invalid refund for payment order ${order.id}`,
			);
		}

		const updated = await this.orderRefundsService.updateRefundStatus({
			paymentIntentId: order.providerPaymentIntentId,
			providerRefundId: refund.id,
			refundStatus: refund.status,
		});

		if (!updated) {
			throw new OrderInvariantViolationError(
				`Stripe refund ${refund.id} could not reconcile payment order ${order.id}`,
			);
		}

		return true;
	}

	private async ensureFailed(
		order: PaymentOrderRow,
		failureReason: string,
	): Promise<PaymentOrderRow | null> {
		if (order.status === "failed") {
			return order;
		}

		if (order.status !== "paid" && order.status !== "fulfilling") {
			return null;
		}

		const failed = await this.paymentOrdersRepository.markFailed(
			order.id,
			failureReason,
		);

		if (failed) {
			return failed;
		}

		const current = await this.paymentOrdersRepository.findById(order.id);

		return current?.status === "failed" ? current : null;
	}
}
