import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	BILLING_CATALOG,
	type BillingCheckoutResponse,
	type BillingPlansResponse,
	type BillingPortalResponse,
	type BillingSubscriptionViewResponse,
	billingPlanIds,
	type ChangeBillingSubscriptionBody,
	CREDIT_TIERS,
	type CreateBillingCheckoutBody,
	type CreateBillingTopupBody,
	priceLookupKey,
	priceUsdFor,
	TOPUP_PACKS,
	topupPackIds,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import { NoActiveSubscriptionError } from "../../domain/errors/no-active-subscription.error";
import {
	PAYMENT_PROVIDER,
	type PaymentProvider,
} from "../../domain/ports/payment-provider.port";
import { mapSubscriptionRow } from "../../infrastructure/mappers/subscription.mapper";
import {
	type BillingCustomerRow,
	BillingCustomersRepository,
} from "../../infrastructure/persistence/billing-customers.repository";
import { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";

@Injectable()
export class BillingService {
	constructor(
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: SubscriptionsRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(PAYMENT_PROVIDER)
		private readonly paymentProvider: PaymentProvider,
	) {}

	plans(): BillingPlansResponse {
		return {
			plans: billingPlanIds.map((plan) => ({
				basePer100Usd: BILLING_CATALOG.plans[plan].basePer100Usd,
				features: {
					seats: plan === "business",
					teamWorkspace: plan === "business",
				},
				id: plan,
				tiers: CREDIT_TIERS.map((tierCredits) => ({
					annualLookupKey: priceLookupKey(plan, tierCredits, "year"),
					annualUsd: priceUsdFor(plan, tierCredits, "year"),
					monthlyLookupKey: priceLookupKey(plan, tierCredits, "month"),
					monthlyUsd: priceUsdFor(plan, tierCredits, "month"),
					tierCredits,
				})),
			})),
			topupPacks: topupPackIds.map((packId) => ({
				credits: TOPUP_PACKS[packId].credits,
				id: packId,
				lookupKey: packId,
				usd: TOPUP_PACKS[packId].usd,
			})),
		};
	}

	async getSubscriptionView(
		userId: string,
	): Promise<BillingSubscriptionViewResponse> {
		const [subscription, balance] = await Promise.all([
			this.subscriptionsRepository.findActiveByUserId(userId),
			this.creditsService.getBalance(userId),
		]);

		return {
			balance,
			subscription: subscription ? mapSubscriptionRow(subscription) : null,
		};
	}

	async checkout(
		user: AuthUser,
		body: CreateBillingCheckoutBody,
	): Promise<BillingCheckoutResponse> {
		const activeSubscription =
			await this.subscriptionsRepository.findActiveByUserId(user.id);

		if (activeSubscription) {
			throw new ActiveSubscriptionExistsError();
		}

		const customer = await this.ensureCustomer(user);
		const url = await this.paymentProvider.createSubscriptionCheckout({
			customerId: customer.providerCustomerId,
			email: user.email,
			interval: body.interval,
			plan: body.plan,
			tierCredits: body.tierCredits,
			userId: user.id,
		});

		return { url };
	}

	async topup(
		user: AuthUser,
		body: CreateBillingTopupBody,
	): Promise<BillingCheckoutResponse> {
		const customer = await this.ensureCustomer(user);
		const pack = TOPUP_PACKS[body.packId];
		const url = await this.paymentProvider.createTopupCheckout({
			credits: pack.credits,
			customerId: customer.providerCustomerId,
			packId: body.packId,
			userId: user.id,
		});

		return { url };
	}

	async portal(user: AuthUser): Promise<BillingPortalResponse> {
		const customer = await this.billingCustomersRepository.findByUserId(
			user.id,
		);

		if (!customer) {
			throw new NoActiveSubscriptionError();
		}

		const url = await this.paymentProvider.createPortalSession(
			customer.providerCustomerId,
		);

		return { url };
	}

	async change(
		user: AuthUser,
		body: ChangeBillingSubscriptionBody,
	): Promise<BillingSubscriptionViewResponse> {
		const subscription = await this.requireActiveSubscription(user.id);
		const lookupKey = priceLookupKey(
			subscription.plan,
			body.tierCredits,
			body.interval,
		);

		await this.paymentProvider.changeSubscription(
			subscription.providerSubscriptionId,
			lookupKey,
		);

		return this.getSubscriptionView(user.id);
	}

	async cancel(user: AuthUser): Promise<BillingSubscriptionViewResponse> {
		const subscription = await this.requireActiveSubscription(user.id);

		await this.paymentProvider.setCancelAtPeriodEnd(
			subscription.providerSubscriptionId,
			true,
		);
		await this.subscriptionsRepository.updateCancelAtPeriodEnd(
			subscription.providerSubscriptionId,
			true,
		);

		return this.getSubscriptionView(user.id);
	}

	async resume(user: AuthUser): Promise<BillingSubscriptionViewResponse> {
		const subscription = await this.requireActiveSubscription(user.id);

		await this.paymentProvider.setCancelAtPeriodEnd(
			subscription.providerSubscriptionId,
			false,
		);
		await this.subscriptionsRepository.updateCancelAtPeriodEnd(
			subscription.providerSubscriptionId,
			false,
		);

		return this.getSubscriptionView(user.id);
	}

	private async ensureCustomer(user: AuthUser): Promise<BillingCustomerRow> {
		const existing = await this.billingCustomersRepository.findByUserId(
			user.id,
		);

		if (existing) {
			return existing;
		}

		const providerCustomerId = await this.paymentProvider.ensureCustomer(
			user.id,
			user.email,
		);

		return this.billingCustomersRepository.upsertByUserId({
			provider: "stripe",
			providerCustomerId,
			userId: user.id,
		});
	}

	private async requireActiveSubscription(userId: string) {
		const subscription =
			await this.subscriptionsRepository.findActiveByUserId(userId);

		if (!subscription) {
			throw new NoActiveSubscriptionError();
		}

		return subscription;
	}
}
