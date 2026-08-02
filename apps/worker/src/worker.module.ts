// Root module for the worker process.
//
// This is the worker version of AppModule. It wires together config, database,
// queues, processors, Redis publishing, and reused services.
//
// Important chat path:
// API queues job -> AiGenerationProcessor runs job -> worker writes DB/Redis.
import { gateway } from "@ai-sdk/gateway";
import { Logger, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsService } from "../../server/src/infrastructure/analytics/analytics.service";
import { AffiliateApprovalService } from "../../server/src/modules/affiliates/application/services/affiliate-approval.service";
import { AffiliateAttributionService } from "../../server/src/modules/affiliates/application/services/affiliate-attribution.service";
import { AffiliateClawbackService } from "../../server/src/modules/affiliates/application/services/affiliate-clawback.service";
import { AffiliateCommissionService } from "../../server/src/modules/affiliates/application/services/affiliate-commission.service";
import { AffiliateTokenService } from "../../server/src/modules/affiliates/application/services/affiliate-token.service";
import { AffiliatesRepository } from "../../server/src/modules/affiliates/infrastructure/persistence/affiliates.repository";
import { SignupGrantOutboxService } from "../../server/src/modules/auth/application/services/signup-grant-outbox.service";
import { SignupGrantOutboxRepository } from "../../server/src/modules/auth/infrastructure/persistence/signup-grant-outbox.repository";
import { BillingService } from "../../server/src/modules/billing/application/services/billing.service";
import { BillingCustomerService } from "../../server/src/modules/billing/application/services/billing-customer.service";
import { BillingWebhookRetryService } from "../../server/src/modules/billing/application/services/billing-webhook-retry.service";
import { PaymentRefundsService } from "../../server/src/modules/billing/application/services/payment-refunds.service";
import { StripeEventRouter } from "../../server/src/modules/billing/application/services/stripe-event-router.service";
import { StripeSubscriptionSyncService } from "../../server/src/modules/billing/application/services/stripe-subscription-sync.service";
import { StripeWebhookProcessor } from "../../server/src/modules/billing/application/services/stripe-webhook-processor.service";
import { SubscriptionCreditsService } from "../../server/src/modules/billing/application/services/subscription-credits.service";
import { SubscriptionRefillService } from "../../server/src/modules/billing/application/services/subscription-refill.service";
import { PAYMENT_PROVIDER } from "../../server/src/modules/billing/domain/ports/payment-provider.port";
import { WEBHOOK_ORDER_RECONCILER } from "../../server/src/modules/billing/domain/ports/webhook-order-reconciler.port";
import { WEBHOOK_ORDER_REFUND_HANDLER } from "../../server/src/modules/billing/domain/ports/webhook-order-refund-handler.port";
import { BillingChangeIntentsRepository } from "../../server/src/modules/billing/infrastructure/persistence/billing-change-intents.repository";
import { BillingCheckoutAttemptsRepository } from "../../server/src/modules/billing/infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingCreditLedgerRepository } from "../../server/src/modules/billing/infrastructure/persistence/billing-credit-ledger.repository";
import { BillingCustomersRepository } from "../../server/src/modules/billing/infrastructure/persistence/billing-customers.repository";
import { BillingWebhookEventsRepository } from "../../server/src/modules/billing/infrastructure/persistence/billing-webhook-events.repository";
import { SubscriptionCreditsRepository } from "../../server/src/modules/billing/infrastructure/persistence/subscription-credits.repository";
import { SubscriptionsRepository } from "../../server/src/modules/billing/infrastructure/persistence/subscriptions.repository";
import { StripeProvider } from "../../server/src/modules/billing/infrastructure/stripe/stripe.provider";
import { ConnectorGenerationRecoveryService } from "../../server/src/modules/connector-generations/application/services/connector-generation-recovery.service";
import { ConnectorGenerationsRepository } from "../../server/src/modules/connector-generations/infrastructure/persistence/connector-generations.repository";
import { CreditsService } from "../../server/src/modules/credits/application/services/credits.service";
import { CreditsRepository } from "../../server/src/modules/credits/infrastructure/persistence/credits.repository";
import {
	DOMAINS_LOGGER,
	DomainsService,
} from "../../server/src/modules/domains/application/services/domains.service";
import { DOMAIN_PROVIDER } from "../../server/src/modules/domains/domain/ports/domain-provider.port";
import { CustomHostnameService } from "../../server/src/modules/domains/infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "../../server/src/modules/domains/infrastructure/cloudflare/domain-routing.service";
import { NamecomProvider } from "../../server/src/modules/domains/infrastructure/namecom/namecom.provider";
import { DomainsRepository } from "../../server/src/modules/domains/infrastructure/persistence/domains.repository";
import { MeteringService } from "../../server/src/modules/metering/application/services/metering.service";
import { ModelPricingService } from "../../server/src/modules/metering/application/services/model-pricing.service";
import {
	METERING_GATEWAY,
	METERING_RECONCILIATION_SCHEDULER,
} from "../../server/src/modules/metering/domain/metering";
import { MeteringRepository } from "../../server/src/modules/metering/infrastructure/persistence/metering.repository";
import { ModelPricesRepository } from "../../server/src/modules/metering/infrastructure/persistence/model-prices.repository";
import { BullMqMeteringReconciliationScheduler } from "../../server/src/modules/metering/infrastructure/queues/bullmq-metering-reconciliation.scheduler";
import { DomainRegistrationFulfillment } from "../../server/src/modules/orders/application/fulfillment/domain-registration.fulfillment";
import { OrderFulfillmentRegistry } from "../../server/src/modules/orders/application/services/order-fulfillment.registry";
import { OrderRefundExecutorService } from "../../server/src/modules/orders/application/services/order-refund-executor.service";
import { OrderRefundQueueService } from "../../server/src/modules/orders/application/services/order-refund-queue.service";
import { OrderRefundsService } from "../../server/src/modules/orders/application/services/order-refunds.service";
import { OrdersService } from "../../server/src/modules/orders/application/services/orders.service";
import {
	ORDER_FULFILLMENT_HANDLERS,
	type OrderFulfillmentHandler,
} from "../../server/src/modules/orders/domain/ports/order-fulfillment.port";
import { PaymentOrdersRepository } from "../../server/src/modules/orders/infrastructure/persistence/payment-orders.repository";
import { queueConfig } from "./config/queue.config";
import { WorkerDatabaseModule } from "./infrastructure/database/database.module";
import { databaseProvider } from "./infrastructure/database/database-alias.provider";
import { WorkerChatRepository } from "./infrastructure/persistence/worker-chat.repository";
import { WorkerQueuesModule } from "./infrastructure/queues/worker-queues.module";
import { ChatEventsPublisher } from "./infrastructure/redis/chat-events.publisher";
import { AffiliateApprovalProcessor } from "./processors/affiliate-approval.processor";
import { AiGenerationProcessor } from "./processors/ai-generation.processor";
import { BillingWebhookProcessor } from "./processors/billing-webhook.processor";
import { DomainsProcessor } from "./processors/domains.processor";
import { LeadProcessingProcessor } from "./processors/lead-processing.processor";
import { MediaGenerationProcessor } from "./processors/media-generation.processor";
import { MeteringProcessor } from "./processors/metering.processor";
import { ModelPricingProcessor } from "./processors/model-pricing.processor";
import { OrderRefundProcessor } from "./processors/order-refund.processor";
import { PublishProcessor } from "./processors/publish.processor";
import { SignupGrantOutboxProcessor } from "./processors/signup-grant-outbox.processor";
import { SubscriptionRefillProcessor } from "./processors/subscription-refill.processor";

// `@Module()` tells Nest what this worker process imports and can inject.
@Module({
	imports: [
		// Load environment-backed config once.
		ConfigModule.forRoot({
			cache: true,
			isGlobal: true,
			load: [queueConfig],
		}),
		WorkerDatabaseModule,
		WorkerQueuesModule,
	],
	providers: [
		// Providers are classes or values Nest can create/inject. Processors are
		// providers too, so registering them starts their BullMQ listeners.
		databaseProvider,
		AffiliateApprovalProcessor,
		AffiliateApprovalService,
		AffiliateAttributionService,
		AffiliateClawbackService,
		AffiliateCommissionService,
		AffiliateTokenService,
		AffiliatesRepository,
		AiGenerationProcessor,
		AnalyticsService,
		BillingChangeIntentsRepository,
		BillingCheckoutAttemptsRepository,
		BillingCreditLedgerRepository,
		BillingCustomerService,
		BillingCustomersRepository,
		BillingService,
		BillingWebhookProcessor,
		BillingWebhookEventsRepository,
		BillingWebhookRetryService,
		BullMqMeteringReconciliationScheduler,
		ChatEventsPublisher,
		ConnectorGenerationRecoveryService,
		ConnectorGenerationsRepository,
		CreditsRepository,
		CreditsService,
		CustomHostnameService,
		DomainRegistrationFulfillment,
		DomainRoutingService,
		DomainsProcessor,
		DomainsRepository,
		DomainsService,
		MediaGenerationProcessor,
		MeteringProcessor,
		MeteringRepository,
		MeteringService,
		ModelPricesRepository,
		ModelPricingProcessor,
		ModelPricingService,
		LeadProcessingProcessor,
		NamecomProvider,
		OrderRefundExecutorService,
		OrderFulfillmentRegistry,
		OrderRefundProcessor,
		OrderRefundQueueService,
		OrderRefundsService,
		OrdersService,
		PaymentRefundsService,
		PaymentOrdersRepository,
		PublishProcessor,
		SignupGrantOutboxProcessor,
		SignupGrantOutboxRepository,
		SignupGrantOutboxService,
		StripeProvider,
		StripeEventRouter,
		StripeSubscriptionSyncService,
		StripeWebhookProcessor,
		SubscriptionCreditsService,
		SubscriptionCreditsRepository,
		SubscriptionRefillProcessor,
		SubscriptionRefillService,
		SubscriptionsRepository,
		WorkerChatRepository,
		// Aliases: when code asks for these tokens, give it these implementations.
		{
			provide: METERING_GATEWAY,
			useValue: gateway,
		},
		{
			provide: METERING_RECONCILIATION_SCHEDULER,
			useExisting: BullMqMeteringReconciliationScheduler,
		},
		{
			provide: DOMAIN_PROVIDER,
			useExisting: NamecomProvider,
		},
		{
			provide: DOMAINS_LOGGER,
			useFactory: () => new Logger(DomainsService.name),
		},
		{
			provide: ORDER_FULFILLMENT_HANDLERS,
			useFactory: (
				domainRegistration: DomainRegistrationFulfillment,
			): OrderFulfillmentHandler[] => [domainRegistration],
			inject: [DomainRegistrationFulfillment],
		},
		{
			provide: PAYMENT_PROVIDER,
			useExisting: StripeProvider,
		},
		{
			provide: WEBHOOK_ORDER_RECONCILER,
			useExisting: OrdersService,
		},
		{
			provide: WEBHOOK_ORDER_REFUND_HANDLER,
			useExisting: OrderRefundsService,
		},
	],
})
// Empty class: the @Module metadata above is the important part.
export class WorkerModule {}
