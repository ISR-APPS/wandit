import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { QueuesModule } from "../../infrastructure/queues/queues.module";
import { BillingPaymentsModule } from "../billing/billing-payments.module";
import { WEBHOOK_ORDER_RECONCILER } from "../billing/domain/ports/webhook-order-reconciler.port";
import { WEBHOOK_ORDER_REFUND_HANDLER } from "../billing/domain/ports/webhook-order-refund-handler.port";
import { DomainsModule } from "../domains/domains.module";
import { DomainRateLimitGuard } from "../domains/presentation/http/guards/rate-limit.guard";
import { DomainRegistrationFulfillment } from "./application/fulfillment/domain-registration.fulfillment";
import { OrderFulfillmentRegistry } from "./application/services/order-fulfillment.registry";
import { OrderRefundExecutorService } from "./application/services/order-refund-executor.service";
import { OrderRefundQueueService } from "./application/services/order-refund-queue.service";
import { OrderRefundsService } from "./application/services/order-refunds.service";
import { OrdersService } from "./application/services/orders.service";
import {
	ORDER_FULFILLMENT_HANDLERS,
	type OrderFulfillmentHandler,
} from "./domain/ports/order-fulfillment.port";
import { PaymentOrdersRepository } from "./infrastructure/persistence/payment-orders.repository";
import { OrdersController } from "./presentation/http/controllers/orders.controller";

@Module({
	controllers: [OrdersController],
	exports: [WEBHOOK_ORDER_RECONCILER, WEBHOOK_ORDER_REFUND_HANDLER],
	imports: [BillingPaymentsModule, DatabaseModule, DomainsModule, QueuesModule],
	providers: [
		// Module-local limiter instance (in-process map, same as DomainsModule's).
		DomainRateLimitGuard,
		DomainRegistrationFulfillment,
		OrderFulfillmentRegistry,
		OrderRefundExecutorService,
		OrderRefundQueueService,
		OrderRefundsService,
		OrdersService,
		PaymentOrdersRepository,
		{
			inject: [DomainRegistrationFulfillment],
			provide: ORDER_FULFILLMENT_HANDLERS,
			useFactory: (
				domainRegistration: DomainRegistrationFulfillment,
			): OrderFulfillmentHandler[] => [domainRegistration],
		},
		{
			provide: WEBHOOK_ORDER_REFUND_HANDLER,
			useExisting: OrderRefundsService,
		},
		{
			provide: WEBHOOK_ORDER_RECONCILER,
			useExisting: OrdersService,
		},
	],
})
export class OrdersModule {}
