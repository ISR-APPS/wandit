import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";

import { AffiliatesRepository } from "../../../affiliates/infrastructure/persistence/affiliates.repository";

import {
	PAYMENT_PROVIDER,
	type PaymentProvider,
} from "../../domain/ports/payment-provider.port";
import {
	type BillingCustomerRow,
	BillingCustomersRepository,
} from "../../infrastructure/persistence/billing-customers.repository";

/**
 * The single local get-or-create path for Stripe customers.
 *
 * The database advisory lock serializes callers in this deployment, while the
 * provider idempotency key protects retries that cross process boundaries or
 * fail after Stripe succeeds but before the local mapping is committed.
 */
@Injectable()
export class BillingCustomerService {
	constructor(
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(PAYMENT_PROVIDER)
		private readonly paymentProvider: PaymentProvider,
		@Optional()
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository?: AffiliatesRepository,
	) {}

	ensureCustomer(
		user: Pick<AuthUser, "email" | "id">,
	): Promise<BillingCustomerRow> {
		return this.billingCustomersRepository.withUserLock(user.id, async (tx) => {
			const existing = await this.billingCustomersRepository.findByUserId(
				user.id,
				tx,
			);

			if (existing) {
				return existing;
			}

			const affiliateCode =
				(await this.affiliatesRepository?.affiliateCodeForUser(user.id)) ??
				null;
			const providerCustomerId = affiliateCode
				? await this.paymentProvider.ensureCustomer(
						user.id,
						user.email,
						affiliateCode,
					)
				: await this.paymentProvider.ensureCustomer(user.id, user.email);

			return this.billingCustomersRepository.upsertByUserId(
				{
					provider: "stripe",
					providerCustomerId,
					userId: user.id,
				},
				tx,
			);
		});
	}
}
