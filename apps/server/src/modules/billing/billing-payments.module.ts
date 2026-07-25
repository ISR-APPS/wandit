import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { BillingCustomerService } from "./application/services/billing-customer.service";
import { PAYMENT_PROVIDER } from "./domain/ports/payment-provider.port";
import { BillingCustomersRepository } from "./infrastructure/persistence/billing-customers.repository";
import { StripeProvider } from "./infrastructure/stripe/stripe.provider";

@Module({
	exports: [
		BillingCustomerService,
		BillingCustomersRepository,
		PAYMENT_PROVIDER,
		StripeProvider,
	],
	imports: [DatabaseModule],
	providers: [
		BillingCustomerService,
		BillingCustomersRepository,
		StripeProvider,
		{
			provide: PAYMENT_PROVIDER,
			useExisting: StripeProvider,
		},
	],
})
export class BillingPaymentsModule {}
