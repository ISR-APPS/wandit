import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AdminSecurityModule } from "../admin/admin-security.module";
import { AffiliatesModule } from "../affiliates/affiliates.module";
import { CreditsModule } from "../credits/credits.module";
import { EmailModule } from "../email/email.module";
import { OrdersModule } from "../orders/orders.module";
import { SettingsModule } from "../settings/settings.module";
import { BillingService } from "./application/services/billing.service";
import { BillingWebhookRetryService } from "./application/services/billing-webhook-retry.service";
import { ManualSubscriptionRequestsService } from "./application/services/manual-subscription-requests.service";
import { ManualSubscriptionsService } from "./application/services/manual-subscriptions.service";
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
import { BillingWebhookEventsRepository } from "./infrastructure/persistence/billing-webhook-events.repository";
import { CancellationReasonsRepository } from "./infrastructure/persistence/cancellation-reasons.repository";
import { ManualSubscriptionPaymentsRepository } from "./infrastructure/persistence/manual-subscription-payments.repository";
import { ManualSubscriptionRequestsRepository } from "./infrastructure/persistence/manual-subscription-requests.repository";
import { SubscriptionCreditsRepository } from "./infrastructure/persistence/subscription-credits.repository";
import { SubscriptionStateEventsRepository } from "./infrastructure/persistence/subscription-state-events.repository";
import { SubscriptionsRepository } from "./infrastructure/persistence/subscriptions.repository";
import { AdminManualBillingController } from "./presentation/http/controllers/admin-manual-billing.controller";
import { BillingController } from "./presentation/http/controllers/billing.controller";
import { ManualBillingController } from "./presentation/http/controllers/manual-billing.controller";
import { StripeWebhookController } from "./presentation/http/controllers/stripe-webhook.controller";
import { WebOriginWriteGuard } from "./presentation/http/guards/web-origin-write.guard";

@Module({
	controllers: [
		AdminManualBillingController,
		BillingController,
		ManualBillingController,
		StripeWebhookController,
	],
	exports: [
		BillingService,
		BillingWebhookRetryService,
		SubscriptionRefillService,
	],
	imports: [
		AdminSecurityModule,
		AffiliatesModule,
		BillingPaymentsModule,
		CreditsModule,
		DatabaseModule,
		EmailModule,
		OrdersModule,
		SettingsModule,
	],
	providers: [
		WebOriginWriteGuard,
		BillingChangeIntentsRepository,
		BillingCheckoutAttemptsRepository,
		BillingCreditLedgerRepository,
		BillingPaymentAdjustmentsRepository,
		BillingService,
		BillingWebhookRetryService,
		BillingWebhookEventsRepository,
		CancellationReasonsRepository,
		ManualSubscriptionPaymentsRepository,
		ManualSubscriptionRequestsRepository,
		ManualSubscriptionRequestsService,
		ManualSubscriptionsService,
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
