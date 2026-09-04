import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	ENTITLED_SUBSCRIPTION_STATUSES,
	type ParsedPriceLookupKey,
	parsePriceLookupKey,
} from "@wandit/contracts";
import type Stripe from "stripe";
import {
	type CreditOwner,
	creditOwnerKey,
	orgOwner,
	userOwner,
} from "../../../credits/domain/credit-owner";
import {
	PAYMENT_PROVIDER,
	type PaymentProvider,
} from "../../domain/ports/payment-provider.port";
import { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import { OrganizationBillingCustomersRepository } from "../../infrastructure/persistence/organization-billing-customers.repository";
import {
	type SubscriptionRow,
	SubscriptionsRepository,
	type SubscriptionsTransaction,
} from "../../infrastructure/persistence/subscriptions.repository";

type PreparedSubscription = {
	existing: SubscriptionRow | null;
	item: Stripe.SubscriptionItem | null;
	lookupKey: string | null;
	parsed: ParsedPriceLookupKey | null;
	subscription: Stripe.Subscription;
};

@Injectable()
export class StripeSubscriptionSyncService {
	private readonly logger = new Logger(StripeSubscriptionSyncService.name);

	constructor(
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: SubscriptionsRepository,
		@Inject(PAYMENT_PROVIDER)
		private readonly paymentProvider: PaymentProvider,
		@Inject(OrganizationBillingCustomersRepository)
		private readonly organizationBillingCustomersRepository: OrganizationBillingCustomersRepository,
	) {}

	async syncFromStripe(providerCustomerId: string): Promise<SubscriptionRow[]> {
		// Personal table first, then org customers — the two tables partition
		// Stripe customer ids, so exactly one owner can match (design §5.1).
		const customer =
			await this.billingCustomersRepository.findByProviderCustomerId(
				providerCustomerId,
			);
		const orgCustomer = customer
			? null
			: await this.organizationBillingCustomersRepository.findByProviderCustomerId(
					providerCustomerId,
				);

		if (!customer && !orgCustomer) {
			throw new Error(
				`Could not resolve billing customer for Stripe customer ${providerCustomerId}`,
			);
		}

		const owner: CreditOwner = customer
			? userOwner(customer.userId)
			: orgOwner((orgCustomer as { organizationId: string }).organizationId);
		// Mirror rows keep a NOT NULL provenance userId even for org
		// subscriptions: the purchasing/creating admin. No money path reads it.
		const ownerIds = {
			organizationId: customer ? null : (orgCustomer?.organizationId ?? null),
			userId: customer ? customer.userId : (orgCustomer?.createdByUserId ?? ""),
		};

		return this.subscriptionsRepository.withStripeCustomerSyncLock(
			providerCustomerId,
			async (tx) => {
				const subscriptions =
					await this.paymentProvider.listSubscriptionsForCustomer(
						providerCustomerId,
					);
				const remoteSubscriptionIds = new Set(
					subscriptions.map((subscription) => subscription.id),
				);
				const prepared: PreparedSubscription[] = [];
				const mirrored: SubscriptionRow[] = [];

				for (const subscription of subscriptions) {
					const trackable = await this.prepareSubscription(subscription, tx);

					if (trackable) {
						prepared.push(trackable);
					}
				}

				const terminal = prepared.filter(({ subscription }) =>
					this.isTerminal(subscription.status),
				);

				for (const candidate of terminal) {
					const row = await this.mirrorPreparedSubscription(
						candidate,
						ownerIds,
						tx,
					);

					if (row) {
						mirrored.push(row);
					}
				}

				const nonTerminal = prepared
					.filter(({ subscription }) => !this.isTerminal(subscription.status))
					.sort((left, right) => {
						const entitledDifference =
							Number(this.isEntitled(right.subscription.status)) -
							Number(this.isEntitled(left.subscription.status));

						if (entitledDifference !== 0) {
							return entitledDifference;
						}

						const createdDifference =
							right.subscription.created - left.subscription.created;

						return createdDifference !== 0
							? createdDifference
							: right.subscription.id.localeCompare(left.subscription.id);
					});
				const [canonical, ...duplicates] = nonTerminal;
				const localNonTerminal =
					await this.subscriptionsRepository.findActiveByOwnerAndProvider(
						owner,
						"stripe",
						tx,
					);

				if (
					localNonTerminal &&
					(!remoteSubscriptionIds.has(
						localNonTerminal.providerSubscriptionId,
					) ||
						localNonTerminal.providerSubscriptionId !==
							canonical?.subscription.id)
				) {
					await this.subscriptionsRepository.updateStatus(
						localNonTerminal.providerSubscriptionId,
						"canceled",
						tx,
					);
				}

				if (canonical) {
					const row = await this.mirrorPreparedSubscription(
						canonical,
						ownerIds,
						tx,
					);

					if (row) {
						mirrored.push(row);
					}

					for (const duplicate of duplicates) {
						this.logger.error(
							`Duplicate active subscription detected for owner ${creditOwnerKey(owner)}: mirroring ${canonical.subscription.id}, leaving ${duplicate.subscription.id} in Stripe for manual remediation`,
						);
					}
				}

				return mirrored;
			},
		);
	}

	private async prepareSubscription(
		subscription: Stripe.Subscription,
		tx: SubscriptionsTransaction,
	): Promise<PreparedSubscription | null> {
		const item = subscription.items.data[0] ?? null;
		const lookupKey = item?.price.lookup_key;
		const parsed = lookupKey ? parsePriceLookupKey(lookupKey) : null;

		if (item && lookupKey && parsed) {
			return {
				existing: null,
				item,
				lookupKey,
				parsed,
				subscription,
			};
		}

		const existing =
			await this.subscriptionsRepository.findByProviderSubscriptionId(
				subscription.id,
				tx,
			);

		if (!existing) {
			this.logger.warn(
				`Skipping Stripe subscription ${subscription.id}: unrecognized price lookup key ${lookupKey ?? "<missing>"}`,
			);

			return null;
		}

		this.logger.warn(
			`Updating tracked Stripe subscription ${subscription.id} despite unrecognized price lookup key ${lookupKey ?? "<missing>"}`,
		);

		return {
			existing,
			item,
			lookupKey: lookupKey ?? null,
			parsed,
			subscription,
		};
	}

	private mirrorPreparedSubscription(
		prepared: PreparedSubscription,
		ownerIds: { organizationId: string | null; userId: string },
		tx: SubscriptionsTransaction,
	): Promise<SubscriptionRow | null> {
		const { existing, item, lookupKey, parsed, subscription } = prepared;

		if (!item || !lookupKey || !parsed) {
			if (!existing) {
				return Promise.resolve(null);
			}

			return this.subscriptionsRepository.updateProviderState(
				{
					cancelAtPeriodEnd: subscription.cancel_at_period_end,
					currentPeriodEnd: item
						? this.dateFromSeconds(item.current_period_end)
						: existing.currentPeriodEnd,
					currentPeriodStart: item
						? this.dateFromSeconds(item.current_period_start)
						: existing.currentPeriodStart,
					providerSubscriptionId: subscription.id,
					status: subscription.status,
				},
				tx,
			);
		}

		return this.upsertRecognizedSubscription(
			{ ...prepared, item, lookupKey, parsed },
			ownerIds,
			tx,
		);
	}

	private async upsertRecognizedSubscription(
		prepared: PreparedSubscription & {
			item: Stripe.SubscriptionItem;
			lookupKey: string;
			parsed: ParsedPriceLookupKey;
		},
		ownerIds: { organizationId: string | null; userId: string },
		tx: SubscriptionsTransaction,
	): Promise<SubscriptionRow> {
		const { item, lookupKey, parsed, subscription } = prepared;
		const mirrored =
			await this.subscriptionsRepository.upsertByProviderSubscriptionId(
				{
					cancelAtPeriodEnd: subscription.cancel_at_period_end,
					currentPeriodEnd: this.dateFromSeconds(item.current_period_end),
					currentPeriodStart: this.dateFromSeconds(item.current_period_start),
					interval: parsed.interval,
					organizationId: ownerIds.organizationId,
					plan: parsed.plan,
					priceLookupKey: lookupKey,
					provider: "stripe",
					providerSubscriptionId: subscription.id,
					status: subscription.status,
					tierCredits: parsed.tierCredits,
					userId: ownerIds.userId,
				},
				tx,
			);
		const cleared = await this.subscriptionsRepository.clearMatchingPendingTier(
			subscription.id,
			parsed.tierCredits,
			tx,
			{ interval: parsed.interval, plan: parsed.plan },
		);

		return cleared ?? mirrored;
	}

	private isEntitled(status: Stripe.Subscription.Status) {
		return (ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
			status,
		);
	}

	private isTerminal(status: Stripe.Subscription.Status) {
		return status === "canceled" || status === "incomplete_expired";
	}

	private dateFromSeconds(seconds: number) {
		return new Date(seconds * 1000);
	}
}
