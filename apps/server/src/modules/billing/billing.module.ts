import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditsModule } from "../credits/credits.module";
import { OrdersModule } from "../orders/orders.module";
import { BillingService } from "./application/services/billing.service";
import { PaymentRefundsService } from "./application/services/payment-refunds.service";
import { StripeEventRouter } from "./application/services/stripe-event-router.service";
import { StripeSubscriptionSyncService } from "./application/services/stripe-subscription-sync.service";
import { StripeWebhookProcessor } from "./application/services/stripe-webhook-processor.service";
import { SubscriptionCreditsService } from "./application/services/subscription-credits.service";
import { BillingPaymentsModule } from "./billing-payments.module";
import { BillingCreditLedgerRepository } from "./infrastructure/persistence/billing-credit-ledger.repository";
import { BillingWebhookEventsRepository } from "./infrastructure/persistence/billing-webhook-events.repository";
import { SubscriptionsRepository } from "./infrastructure/persistence/subscriptions.repository";
import { BillingController } from "./presentation/http/controllers/billing.controller";
import { StripeWebhookController } from "./presentation/http/controllers/stripe-webhook.controller";

@Module({
	controllers: [BillingController, StripeWebhookController],
	exports: [BillingService],
	imports: [BillingPaymentsModule, CreditsModule, DatabaseModule, OrdersModule],
	providers: [
		BillingCreditLedgerRepository,
		BillingService,
		BillingWebhookEventsRepository,
		PaymentRefundsService,
		StripeEventRouter,
		StripeSubscriptionSyncService,
		StripeWebhookProcessor,
		SubscriptionCreditsService,
		SubscriptionsRepository,
	],
})
export class BillingModule {}
