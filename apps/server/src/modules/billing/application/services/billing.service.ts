import { Inject, Injectable, Logger } from "@nestjs/common";
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
	ENTITLED_SUBSCRIPTION_STATUSES,
	priceLookupKey,
	priceUsdFor,
	TOPUP_PACKS,
	topupPackIds,
} from "@wandit/contracts";

import { CreditsService } from "../../../credits/application/services/credits.service";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import { BillingNotConfiguredError } from "../../domain/errors/billing-not-configured.error";
import { NoActiveSubscriptionError } from "../../domain/errors/no-active-subscription.error";
import { PaymentPastDueError } from "../../domain/errors/payment-past-due.error";
import {
	PAYMENT_PROVIDER,
	type PaymentProvider,
} from "../../domain/ports/payment-provider.port";
import { mapSubscriptionRow } from "../../infrastructure/mappers/subscription.mapper";
import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";
import { BillingCustomerService } from "./billing-customer.service";
import { StripeSubscriptionSyncService } from "./stripe-subscription-sync.service";

@Injectable()
export class BillingService {
	private readonly logger = new Logger(BillingService.name);

	constructor(
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: SubscriptionsRepository,
		@Inject(CreditsService)
		private readonly creditsService: CreditsService,
		@Inject(PAYMENT_PROVIDER)
		private readonly paymentProvider: PaymentProvider,
		@Inject(BillingCustomerService)
		private readonly billingCustomerService: BillingCustomerService,
		@Inject(StripeSubscriptionSyncService)
		private readonly subscriptionSyncService: StripeSubscriptionSyncService,
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

	async hasActiveSubscription(userId: string): Promise<boolean> {
		const subscription =
			await this.subscriptionsRepository.findActiveByUserId(userId);

		return subscription !== null && this.isEntitled(subscription.status);
	}

	async checkout(
		user: AuthUser,
		body: CreateBillingCheckoutBody,
	): Promise<BillingCheckoutResponse> {
		const visibleSubscription =
			await this.subscriptionsRepository.findActiveByUserId(user.id);

		if (visibleSubscription) {
			this.throwCheckoutBlocked(visibleSubscription.status);
		}

		await this.billingCustomerService.ensureCustomer(user);
		let createdCheckoutId: string | null = null;

		try {
			return await this.billingCustomersRepository.withUserLock(
				user.id,
				async (tx) => {
					const customer = await this.billingCustomersRepository.findByUserId(
						user.id,
						tx,
					);

					if (!customer) {
						throw new Error(
							`Billing customer mapping disappeared for user ${user.id}`,
						);
					}

					const providerSubscriptions =
						await this.paymentProvider.listSubscriptionsForCustomer(
							customer.providerCustomerId,
						);
					const entitledSubscription = providerSubscriptions.find(
						(subscription) => this.isEntitled(subscription.status),
					);
					const blockingSubscription =
						entitledSubscription ??
						providerSubscriptions.find((subscription) =>
							this.isNonTerminal(subscription.status),
						);

					if (blockingSubscription) {
						this.throwCheckoutBlocked(blockingSubscription.status);
					}

					if (customer.openCheckoutSessionId) {
						await this.paymentProvider.expireCheckoutSession(
							customer.openCheckoutSessionId,
						);
					}

					const checkout =
						await this.paymentProvider.createSubscriptionCheckout({
							customerId: customer.providerCustomerId,
							email: user.email,
							interval: body.interval,
							plan: body.plan,
							tierCredits: body.tierCredits,
							userId: user.id,
						});
					createdCheckoutId = checkout.id;

					await this.billingCustomersRepository.setOpenCheckoutSessionId(
						user.id,
						checkout.id,
						tx,
					);

					return { url: checkout.url };
				},
			);
		} catch (error) {
			if (createdCheckoutId) {
				try {
					await this.paymentProvider.expireCheckoutSession(createdCheckoutId);
				} catch (compensationError) {
					this.logger.error(
						`Failed to expire unpersisted Stripe checkout session ${createdCheckoutId} for user ${user.id}`,
						compensationError instanceof Error
							? compensationError.message
							: String(compensationError),
					);
				}
			}

			throw error;
		}
	}

	async topup(
		user: AuthUser,
		body: CreateBillingTopupBody,
	): Promise<BillingCheckoutResponse> {
		const customer = await this.billingCustomerService.ensureCustomer(user);
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
		const customer = await this.billingCustomersRepository.findByUserId(
			user.id,
		);

		if (!customer) {
			throw new Error(
				`Subscription ${subscription.providerSubscriptionId} has no billing customer`,
			);
		}
		const lookupKey = priceLookupKey(
			body.plan ?? subscription.plan,
			body.tierCredits,
			body.interval,
		);

		await this.paymentProvider.changeSubscription(
			subscription.providerSubscriptionId,
			lookupKey,
		);
		await this.subscriptionSyncService.syncFromStripe(
			customer.providerCustomerId,
		);

		return this.getSubscriptionView(user.id);
	}

	async sync(user: AuthUser): Promise<BillingSubscriptionViewResponse> {
		const customer = await this.billingCustomersRepository.findByUserId(
			user.id,
		);

		if (!customer) {
			return this.getSubscriptionView(user.id);
		}

		try {
			await this.subscriptionSyncService.syncFromStripe(
				customer.providerCustomerId,
			);
		} catch (error) {
			if (!(error instanceof BillingNotConfiguredError)) {
				throw error;
			}
		}

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

	private async requireActiveSubscription(userId: string) {
		const subscription =
			await this.subscriptionsRepository.findActiveByUserId(userId);

		if (!subscription) {
			throw new NoActiveSubscriptionError();
		}

		return subscription;
	}

	private isEntitled(status: string) {
		return (ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
			status,
		);
	}

	private isNonTerminal(status: string) {
		return status !== "canceled" && status !== "incomplete_expired";
	}

	private throwCheckoutBlocked(status: string): never {
		if (status === "past_due") {
			throw new PaymentPastDueError();
		}

		throw new ActiveSubscriptionExistsError();
	}
}
