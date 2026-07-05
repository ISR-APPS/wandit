import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { CreditsModule } from "../credits/credits.module";
import { BillingService } from "./application/services/billing.service";
import { StripeWebhookProcessor } from "./application/services/stripe-webhook-processor.service";
import { PAYMENT_PROVIDER } from "./domain/ports/payment-provider.port";
import { BillingCreditLedgerRepository } from "./infrastructure/persistence/billing-credit-ledger.repository";
import { BillingCustomersRepository } from "./infrastructure/persistence/billing-customers.repository";
import { BillingWebhookEventsRepository } from "./infrastructure/persistence/billing-webhook-events.repository";
import { SubscriptionsRepository } from "./infrastructure/persistence/subscriptions.repository";
import { StripeProvider } from "./infrastructure/stripe/stripe.provider";
import { BillingController } from "./presentation/http/controllers/billing.controller";
import { StripeWebhookController } from "./presentation/http/controllers/stripe-webhook.controller";

@Module({
	controllers: [BillingController, StripeWebhookController],
	exports: [BillingService],
	imports: [DatabaseModule, CreditsModule],
	providers: [
		BillingCreditLedgerRepository,
		BillingCustomersRepository,
		BillingService,
		BillingWebhookEventsRepository,
		StripeProvider,
		StripeWebhookProcessor,
		SubscriptionsRepository,
		{
			provide: PAYMENT_PROVIDER,
			useExisting: StripeProvider,
		},
	],
})
export class BillingModule {}
