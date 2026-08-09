import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { BillingPaymentsModule } from "../billing/billing-payments.module";
import { WEBHOOK_ORDER_RECONCILER } from "../billing/domain/ports/webhook-order-reconciler.port";
import { WEBHOOK_ORDER_REFUND_HANDLER } from "../billing/domain/ports/webhook-order-refund-handler.port";
import { DomainsModule } from "../domains/domains.module";
import { DomainRateLimitGuard } from "../domains/presentation/http/guards/rate-limit.guard";
import { DomainRegistrationFulfillment } from "./application/fulfillment/domain-registration.fulfillment";
import { OrderFulfillmentRegistry } from "./application/services/order-fulfillment.registry";
import { OrderRefundsService } from "./application/services/order-refunds.service";
import { OrdersService } from "./application/services/orders.service";
import {
	ORDER_FULFILLMENT_HANDLERS,
	type OrderFulfillmentHandler,
} from "./domain/ports/order-fulfillment.port";
import { ORDER_REFUND_DISPATCHER } from "./domain/ports/order-refund-dispatcher.port";
import { PaymentOrdersRepository } from "./infrastructure/persistence/payment-orders.repository";
import { TriggerOrderRefundDispatcherService } from "./infrastructure/trigger/trigger-order-refund-dispatcher.service";
import { OrdersController } from "./presentation/http/controllers/orders.controller";

@Module({
	controllers: [OrdersController],
	exports: [WEBHOOK_ORDER_RECONCILER, WEBHOOK_ORDER_REFUND_HANDLER],
	imports: [BillingPaymentsModule, DatabaseModule, DomainsModule],
	providers: [
		// Module-local limiter instance (in-process map, same as DomainsModule's).
		DomainRateLimitGuard,
		DomainRegistrationFulfillment,
		OrderFulfillmentRegistry,
		OrderRefundsService,
		OrdersService,
		PaymentOrdersRepository,
		{
			provide: ORDER_REFUND_DISPATCHER,
			useClass: TriggerOrderRefundDispatcherService,
		},
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
