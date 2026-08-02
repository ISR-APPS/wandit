import type { createDb } from "@wandit/db";

import { StripeProvider } from "../modules/billing/infrastructure/stripe/stripe.provider";
import {
	DomainsRepository,
	type DomainTransaction,
} from "../modules/domains/infrastructure/persistence/domains.repository";
import type {
	DurableWait,
	OrderRefundLogger,
} from "../modules/orders/application/refunds/order-refund.contracts";
import { OrderRefundRunner } from "../modules/orders/application/refunds/order-refund.runner";
import { OrderRefundStep } from "../modules/orders/application/refunds/order-refund.step";
import { OrderRefundReconcilerService } from "../modules/orders/application/refunds/order-refund-reconciler.service";
import { OrderRefundsService } from "../modules/orders/application/services/order-refunds.service";
import {
	PaymentOrdersRepository,
	type PaymentOrderTransaction,
} from "../modules/orders/infrastructure/persistence/payment-orders.repository";
import { recoverOrderRefundTask } from "../modules/orders/infrastructure/trigger/trigger-order-refund-dispatcher.service";

type Database = ReturnType<typeof createDb>;

type OrderRefundRuntimeOptions = {
	beforeAttempt(): void;
	logger: OrderRefundLogger;
	wait: DurableWait;
};

/**
 * Hand-wires the framework-light refund runner for a single Trigger task run.
 * The callback wraps the step rather than the task so configuration is checked
 * again after every durable 60-second retry.
 */
export function createOrderRefundRuntime(
	db: Database,
	options: OrderRefundRuntimeOptions,
) {
	const paymentOrders = new PaymentOrdersRepository(db);
	const domains = new DomainsRepository(db);
	const paymentProvider = new StripeProvider();
	const refundState = new OrderRefundsService(paymentOrders, domains);
	const refundStep = new OrderRefundStep(
		paymentOrders,
		paymentProvider,
		refundState,
	);
	const configuredRefundStep = {
		execute: async (orderId: string, failureReason: string) => {
			options.beforeAttempt();

			return refundStep.execute(orderId, failureReason);
		},
	};

	return {
		runner: new OrderRefundRunner(
			configuredRefundStep,
			options.wait,
			options.logger,
		),
	};
}

/** Scheduled DB recovery without the API deployment's secret-key gate. */
export function createOrderRefundReconciliationRuntime(db: Database) {
	const paymentOrders = new PaymentOrdersRepository(db);
	const domains = new DomainsRepository(db);

	return {
		reconciler: new OrderRefundReconcilerService({
			findDomainForUpdate: (orderId, transaction) =>
				domains.findByPaymentOrderIdForUpdate(
					orderId,
					transaction as DomainTransaction,
				),
			findOrder: (orderId) => paymentOrders.findById(orderId),
			findRefundReconciliationCandidates: (input) =>
				paymentOrders.findRefundReconciliationCandidates(input),
			markOrderFailed: (orderId, failureReason, transaction) =>
				paymentOrders.markFailed(
					orderId,
					failureReason,
					transaction as PaymentOrderTransaction,
				),
			now: () => new Date(),
			recoverRefund: recoverOrderRefundTask,
			withOrderFulfillmentFence: (orderId, operation) =>
				paymentOrders.withOrderFulfillmentFence(orderId, (order, transaction) =>
					operation(order, transaction),
				),
		}),
	};
}
