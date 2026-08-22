import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AffiliatesModule } from "../affiliates/affiliates.module";
import { CreditsModule } from "../credits/credits.module";
import { OrdersModule } from "../orders/orders.module";
import { SettingsModule } from "../settings/settings.module";
import { BillingService } from "./application/services/billing.service";
import { BillingWebhookRetryService } from "./application/services/billing-webhook-retry.service";
import { PaymentRefundsService } from "./application/services/payment-refunds.service";
import { StripeEventRouter } from "./application/services/stripe-event-router.service";
import { StripeSubscriptionSyncService } from "./application/services/stripe-subscription-sync.service";
import { StripeWebhookProcessor } from "./application/services/stripe-webhook-processor.service";
import { SubscriptionCreditsService } from "./application/services/subscription-credits.service";
import { SubscriptionLifecycleService } from "./application/services/subscription-lifecycle.service";
import { SubscriptionRefillService } from "./application/services/subscription-refill.service";
import { BillingPaymentsModule } from "./billing-payments.module";
import { BillingChangeIntentsRepository } from "./infrastructure/persistence/billing-change-intents.repository";
import { BillingCheckoutAttemptsRepository } from "./infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingCreditLedgerRepository } from "./infrastructure/persistence/billing-credit-ledger.repository";
import { BillingPaymentAdjustmentsRepository } from "./infrastructure/persistence/billing-payment-adjustments.repository";
import { BillingTopupReceiptsRepository } from "./infrastructure/persistence/billing-topup-receipts.repository";
import { BillingWebhookEventsRepository } from "./infrastructure/persistence/billing-webhook-events.repository";
import { CancellationReasonsRepository } from "./infrastructure/persistence/cancellation-reasons.repository";
import { FinancialReconciliationOutboxRepository } from "./infrastructure/persistence/financial-reconciliation-outbox.repository";
import { SubscriptionCreditsRepository } from "./infrastructure/persistence/subscription-credits.repository";
import { SubscriptionStateEventsRepository } from "./infrastructure/persistence/subscription-state-events.repository";
import { SubscriptionsRepository } from "./infrastructure/persistence/subscriptions.repository";
import { BillingController } from "./presentation/http/controllers/billing.controller";
import { StripeWebhookController } from "./presentation/http/controllers/stripe-webhook.controller";

@Module({
	controllers: [BillingController, StripeWebhookController],
	exports: [
		BillingService,
		BillingWebhookRetryService,
		SubscriptionRefillService,
	],
	imports: [
		AffiliatesModule,
		BillingPaymentsModule,
		CreditsModule,
		DatabaseModule,
		OrdersModule,
		SettingsModule,
	],
	providers: [
		BillingChangeIntentsRepository,
		BillingCheckoutAttemptsRepository,
		BillingCreditLedgerRepository,
		BillingPaymentAdjustmentsRepository,
		BillingService,
		BillingWebhookRetryService,
		BillingTopupReceiptsRepository,
		BillingWebhookEventsRepository,
		CancellationReasonsRepository,
		FinancialReconciliationOutboxRepository,
		PaymentRefundsService,
		StripeEventRouter,
		StripeSubscriptionSyncService,
		StripeWebhookProcessor,
		SubscriptionCreditsService,
		SubscriptionCreditsRepository,
		SubscriptionLifecycleService,
		SubscriptionRefillService,
		SubscriptionStateEventsRepository,
		SubscriptionsRepository,
	],
})
export class BillingModule {}
