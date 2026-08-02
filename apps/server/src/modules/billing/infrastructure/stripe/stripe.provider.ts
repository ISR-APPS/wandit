import { Injectable, InternalServerErrorException } from "@nestjs/common";
import {
	type BillingInterval,
	type BillingPlanId,
	CHECKOUT_PURPOSE,
	type CreditTier,
	parsePriceLookupKey,
	priceLookupKey,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import Stripe from "stripe";

import { AmbiguousPaymentProviderWriteError } from "../../domain/errors/ambiguous-payment-provider-write.error";
import { BillingNotConfiguredError } from "../../domain/errors/billing-not-configured.error";
import type {
	ApplySubscriptionChangeParams,
	CreateOrderCheckoutParams,
	CreateOrderCheckoutResult,
	CreateRefundParams,
	CreateSubscriptionCheckoutParams,
	CreateSubscriptionCheckoutResult,
	CreateTopupCheckoutParams,
	PaymentProvider,
	PreviewSubscriptionChangeParams,
	ScheduleSubscriptionDowngradeParams,
	SubscriptionChangePreviewProviderResult,
	SubscriptionChangeProviderResult,
} from "../../domain/ports/payment-provider.port";

const STRIPE_API_VERSION = "2026-02-25.clover";
const RESTRICTED_PORTAL_CONFIGURATION_NAME =
	"Wandit restricted billing portal v1";

@Injectable()
export class StripeProvider implements PaymentProvider {
	private readonly priceIdByLookupKey = new Map<string, string>();
	private readonly priceLookupKeyById = new Map<string, string | null>();
	private client: Stripe | null = null;
	private restrictedPortalConfigurationPromise: Promise<string> | null = null;

	async ensureCustomer(
		userId: string,
		email: string,
		affiliateCode?: string | null,
	): Promise<string> {
		const customer = await this.stripe().customers.create(
			{
				email,
				metadata: {
					...(affiliateCode ? { affiliateCode } : {}),
					userId,
				},
			},
			{
				idempotencyKey: `customer:${userId}`,
			},
		);

		return customer.id;
	}

	async createOrderCheckout(
		params: CreateOrderCheckoutParams,
	): Promise<CreateOrderCheckoutResult> {
		const metadata = {
			orderId: params.orderId,
			orderKind: params.kind,
			purpose: CHECKOUT_PURPOSE.order,
			userId: params.userId,
		};
		const session = await this.createCheckoutSession(
			{
				cancel_url: params.cancelUrl,
				client_reference_id: params.orderId,
				customer: params.customerId,
				line_items: [
					{
						price_data: {
							currency: params.currency,
							product_data: {
								name: params.productName,
							},
							unit_amount: params.amountCents,
						},
						quantity: 1,
					},
				],
				metadata,
				mode: "payment",
				payment_intent_data: {
					metadata,
				},
				success_url: params.successUrl,
			},
			{
				idempotencyKey: `order-checkout:${params.orderId}`,
			},
		);

		return {
			id: session.id,
			url: this.expectUrl(session.url, "Stripe order checkout session"),
		};
	}

	async createSubscriptionCheckout(
		params: CreateSubscriptionCheckoutParams,
	): Promise<CreateSubscriptionCheckoutResult> {
		const lookupKey = priceLookupKey(
			params.plan,
			params.tierCredits,
			params.interval,
		);
		const priceId = await this.resolvePriceId(lookupKey);
		const metadata = this.subscriptionMetadata(
			params.userId,
			params.plan,
			params.tierCredits,
			params.interval,
		);
		const attemptMetadata = { ...metadata, attemptId: params.attemptId };
		const session = await this.createCheckoutSession(
			{
				cancel_url: `${env.CORS_ORIGIN}/billing/cancel`,
				client_reference_id: params.userId,
				customer: params.customerId,
				line_items: [
					{
						price: priceId,
						quantity: 1,
					},
				],
				metadata: attemptMetadata,
				mode: "subscription",
				subscription_data: {
					metadata,
				},
				success_url: `${env.CORS_ORIGIN}/billing/success?purpose=subscription`,
			},
			{
				idempotencyKey: `sub-checkout:${params.userId}:${params.attemptId}`,
			},
		);

		return {
			id: session.id,
			url: this.expectUrl(session.url, "Stripe checkout session"),
		};
	}

	async createTopupCheckout(
		params: CreateTopupCheckoutParams,
	): Promise<CreateSubscriptionCheckoutResult> {
		const priceId = await this.resolvePriceId(params.packId);
		const metadata = {
			attemptId: params.attemptId,
			credits: String(params.credits),
			packId: params.packId,
			purpose: CHECKOUT_PURPOSE.topup,
			userId: params.userId,
		};
		const session = await this.createCheckoutSession(
			{
				cancel_url: `${env.CORS_ORIGIN}/billing/cancel`,
				customer: params.customerId,
				line_items: [
					{
						price: priceId,
						quantity: 1,
					},
				],
				metadata,
				mode: "payment",
				payment_intent_data: {
					metadata,
				},
				success_url: `${env.CORS_ORIGIN}/billing/success?purpose=topup`,
			},
			{
				idempotencyKey: `topup-checkout:${params.userId}:${params.attemptId}`,
			},
		);

		return {
			id: session.id,
			url: this.expectUrl(session.url, "Stripe top-up checkout session"),
		};
	}

	createRefund(params: CreateRefundParams): Promise<Stripe.Refund> {
		return this.stripe().refunds.create(
			{
				payment_intent: params.paymentIntentId,
			},
			{
				idempotencyKey: params.idempotencyKey,
			},
		);
	}

	async createPortalSession(customerId: string): Promise<string> {
		const configuration = await this.restrictedPortalConfiguration();
		const session = await this.stripe().billingPortal.sessions.create({
			configuration,
			customer: customerId,
			return_url: `${env.CORS_ORIGIN}/dashboard`,
		});

		return this.expectUrl(session.url, "Stripe billing portal session");
	}

	async expireCheckoutSession(
		sessionId: string,
	): Promise<Stripe.Checkout.Session["status"]> {
		const stripe = this.stripe();
		const session = await stripe.checkout.sessions.retrieve(sessionId);

		if (session.status !== "open") {
			return session.status;
		}

		try {
			const expired = await stripe.checkout.sessions.expire(sessionId);

			return expired.status;
		} catch (error) {
			/*
			 * A customer can complete the Session between the retrieve and expire
			 * calls. Re-read before deciding whether the expiration error is real.
			 */
			const latest = await stripe.checkout.sessions.retrieve(sessionId);

			if (latest.status === "complete" || latest.status === "expired") {
				return latest.status;
			}

			throw error;
		}
	}

	async changeSubscription(
		params: ApplySubscriptionChangeParams,
	): Promise<SubscriptionChangeProviderResult> {
		const parsed = parsePriceLookupKey(params.newPriceLookupKey);

		if (!parsed) {
			throw new InternalServerErrorException(
				"Invalid billing price lookup key",
			);
		}

		const stripe = this.stripe();
		let priorRemoteMutation = false;

		try {
			const [subscription, priceId] = await Promise.all([
				stripe.subscriptions.retrieve(params.providerSubscriptionId, {
					expand: ["latest_invoice"],
				}),
				this.resolvePriceId(params.newPriceLookupKey),
			]);
			const [subscriptionItem] = subscription.items.data;

			if (!subscriptionItem) {
				throw new InternalServerErrorException(
					"Stripe subscription has no subscription items",
				);
			}

			priorRemoteMutation = await this.releaseManagedDowngradeSchedule(
				subscription,
				`${params.idempotencyKey}:release-schedule`,
			);

			if (subscription.pending_update) {
				if (!this.pendingUpdateTargetsPrice(subscription, priceId)) {
					throw new InternalServerErrorException(
						`Stripe subscription ${subscription.id} has a different pending update`,
					);
				}

				return this.pendingSubscriptionChangeResult(subscription);
			}

			// Stripe idempotency records are not permanent. If a prior accepted
			// request outlives that window, the live target is the durable replay
			// signal and prevents a second proration invoice.
			if (subscriptionItem.price.id === priceId) {
				return { outcome: "applied" };
			}

			const updated = await stripe.subscriptions.update(
				params.providerSubscriptionId,
				{
					...(params.billingCycleAnchorNow
						? { billing_cycle_anchor: "now" as const }
						: {}),
					expand: ["latest_invoice"],
					items: [
						{
							id: subscriptionItem.id,
							price: priceId,
						},
					],
					payment_behavior: "pending_if_incomplete",
					proration_behavior: "always_invoice",
					proration_date: Math.floor(params.prorationDate.getTime() / 1000),
				},
				{ idempotencyKey: params.idempotencyKey },
			);
			priorRemoteMutation = true;

			return updated.pending_update
				? this.pendingSubscriptionChangeResult(updated)
				: { outcome: "applied" };
		} catch (error) {
			this.rethrowPaymentWrite(
				error,
				"Stripe subscription change ended with an ambiguous write result",
				priorRemoteMutation,
			);
		}
	}

	async cancelScheduledSubscriptionDowngrade(
		providerSubscriptionId: string,
		idempotencyKey: string,
	): Promise<void> {
		try {
			const subscription = await this.stripe().subscriptions.retrieve(
				providerSubscriptionId,
			);

			await this.releaseManagedDowngradeSchedule(subscription, idempotencyKey);
		} catch (error) {
			this.rethrowPaymentWrite(
				error,
				"Stripe downgrade cancellation ended with an ambiguous write result",
			);
		}
	}

	async scheduleSubscriptionDowngrade(
		params: ScheduleSubscriptionDowngradeParams,
	): Promise<string> {
		const parsed = parsePriceLookupKey(params.newPriceLookupKey);

		if (!parsed) {
			throw new InternalServerErrorException(
				"Invalid billing price lookup key",
			);
		}

		const stripe = this.stripe();
		let priorRemoteMutation = false;

		try {
			const [subscription, priceId] = await Promise.all([
				stripe.subscriptions.retrieve(params.providerSubscriptionId),
				this.resolvePriceId(params.newPriceLookupKey),
			]);
			const item = subscription.items.data[0];

			if (!item) {
				throw new InternalServerErrorException(
					"Stripe subscription has no subscription items",
				);
			}

			let schedule = await this.attachedSchedule(subscription);

			if (schedule) {
				this.assertManagedDowngradeSchedule(
					schedule,
					subscription,
					params.idempotencyKey,
				);
				// An attached application-owned schedule is durable partial state
				// from this intent or an earlier pending downgrade. Do not terminalize
				// the intent if a later configure step fails.
				priorRemoteMutation = true;
			} else {
				await stripe.subscriptions.update(
					params.providerSubscriptionId,
					{
						metadata: {
							wanditScheduleIntent: params.idempotencyKey,
							wanditScheduleOwner: "period_end_downgrade",
							wanditScheduleTarget: params.newPriceLookupKey,
						},
					},
					{ idempotencyKey: `${params.idempotencyKey}:mark-owner` },
				);
				priorRemoteMutation = true;
				schedule = await stripe.subscriptionSchedules.create(
					{ from_subscription: params.providerSubscriptionId },
					{ idempotencyKey: `${params.idempotencyKey}:create-schedule` },
				);
			}

			const currentPhase = schedule.current_phase;

			if (!currentPhase) {
				throw new InternalServerErrorException(
					`Stripe subscription schedule ${schedule.id} has no current phase`,
				);
			}

			await stripe.subscriptionSchedules.update(
				schedule.id,
				{
					end_behavior: "release",
					metadata: {
						wanditScheduleIntent: params.idempotencyKey,
						wanditScheduleOwner: "period_end_downgrade",
						wanditScheduleTarget: params.newPriceLookupKey,
					},
					phases: [
						{
							end_date: item.current_period_end,
							items: [
								{
									price: item.price.id,
									...(item.quantity === null
										? {}
										: { quantity: item.quantity }),
								},
							],
							proration_behavior: "none",
							start_date: currentPhase.start_date,
						},
						{
							duration: { interval: parsed.interval, interval_count: 1 },
							items: [{ price: priceId, quantity: 1 }],
							proration_behavior: "none",
							start_date: item.current_period_end,
						},
					],
					proration_behavior: "none",
				},
				{ idempotencyKey: `${params.idempotencyKey}:configure-schedule` },
			);

			return schedule.id;
		} catch (error) {
			this.rethrowPaymentWrite(
				error,
				"Stripe downgrade scheduling ended with an ambiguous write result",
				priorRemoteMutation,
			);
		}
	}

	async hasPendingSubscriptionUpdate(
		providerSubscriptionId: string,
	): Promise<boolean> {
		const subscription = await this.stripe().subscriptions.retrieve(
			providerSubscriptionId,
		);

		return subscription.pending_update !== null;
	}

	async previewSubscriptionChange(
		params: PreviewSubscriptionChangeParams,
	): Promise<SubscriptionChangePreviewProviderResult> {
		const stripe = this.stripe();
		const [subscription, priceId] = await Promise.all([
			stripe.subscriptions.retrieve(params.providerSubscriptionId),
			this.resolvePriceId(params.newPriceLookupKey),
		]);
		const item = subscription.items.data[0];

		if (!item) {
			throw new InternalServerErrorException(
				"Stripe subscription has no subscription items",
			);
		}

		const preview = await stripe.invoices.createPreview({
			subscription: params.providerSubscriptionId,
			subscription_details: {
				...(params.billingCycleAnchorNow
					? { billing_cycle_anchor: "now" as const }
					: {}),
				items: [{ id: item.id, price: priceId }],
				proration_behavior: "always_invoice",
				proration_date: Math.floor(params.prorationDate.getTime() / 1000),
			},
		});

		return {
			amountDueMinor: preview.amount_due,
			currency: preview.currency,
		};
	}

	async setCancelAtPeriodEnd(
		providerSubscriptionId: string,
		flag: boolean,
	): Promise<void> {
		await this.stripe().subscriptions.update(providerSubscriptionId, {
			cancel_at_period_end: flag,
		});
	}

	constructWebhookEvent(rawBody: Buffer | string, signature: string) {
		const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

		if (!webhookSecret) {
			throw new BillingNotConfiguredError("STRIPE_WEBHOOK_SECRET");
		}

		return this.stripe().webhooks.constructEvent(
			rawBody,
			signature,
			webhookSecret,
		);
	}

	retrieveInvoice(invoiceId: string): Promise<Stripe.Invoice> {
		return this.stripe().invoices.retrieve(invoiceId, {
			expand: [
				"lines.data.pricing.price_details.price",
				"parent.subscription_details.subscription",
				"payments.data.payment.payment_intent.latest_charge",
			],
		});
	}

	async listInvoicePayments(
		invoiceId: string,
	): Promise<Stripe.InvoicePayment[]> {
		return this.stripe()
			.invoicePayments.list({
				expand: ["data.payment.payment_intent.latest_charge"],
				invoice: invoiceId,
				limit: 100,
				status: "paid",
			})
			.autoPagingToArray({ limit: 10_000 });
	}

	retrievePrice(priceId: string): Promise<Stripe.Price> {
		return this.stripe().prices.retrieve(priceId);
	}

	retrieveSubscription(
		providerSubscriptionId: string,
	): Promise<Stripe.Subscription> {
		return this.stripe().subscriptions.retrieve(providerSubscriptionId);
	}

	retrievePaymentIntent(
		paymentIntentId: string,
	): Promise<Stripe.PaymentIntent> {
		return this.stripe().paymentIntents.retrieve(paymentIntentId, {
			expand: ["latest_charge"],
		});
	}

	retrieveCharge(chargeId: string): Promise<Stripe.Charge> {
		return this.stripe().charges.retrieve(chargeId, {
			expand: ["refunds"],
		});
	}

	async listRefundsForCharge(chargeId: string): Promise<Stripe.Refund[]> {
		return this.stripe()
			.refunds.list({ charge: chargeId, limit: 100 })
			.autoPagingToArray({ limit: 10_000 });
	}

	async listDisputesForCharge(chargeId: string): Promise<Stripe.Dispute[]> {
		return this.stripe()
			.disputes.list({ charge: chargeId, limit: 100 })
			.autoPagingToArray({ limit: 10_000 });
	}

	retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
		return this.stripe().checkout.sessions.retrieve(sessionId, {
			expand: ["payment_intent.latest_charge"],
		});
	}

	async listSubscriptionsForCustomer(
		providerCustomerId: string,
	): Promise<Stripe.Subscription[]> {
		const subscriptions = await this.stripe().subscriptions.list({
			customer: providerCustomerId,
			expand: ["data.default_payment_method"],
			limit: 100,
			status: "all",
		});

		return subscriptions.data;
	}

	async lookupKeyForPriceId(priceId: string): Promise<string | null> {
		if (this.priceLookupKeyById.has(priceId)) {
			return this.priceLookupKeyById.get(priceId) ?? null;
		}

		const price = await this.retrievePrice(priceId);
		this.rememberPrice(price);

		return price.lookup_key;
	}

	private attachedSchedule(
		subscription: Stripe.Subscription,
	): Promise<Stripe.SubscriptionSchedule | null> {
		if (!subscription.schedule) {
			return Promise.resolve(null);
		}

		if (typeof subscription.schedule !== "string") {
			return Promise.resolve(subscription.schedule);
		}

		return this.stripe().subscriptionSchedules.retrieve(subscription.schedule);
	}

	private assertManagedDowngradeSchedule(
		schedule: Stripe.SubscriptionSchedule,
		subscription: Stripe.Subscription,
		orphanIntent?: string,
	): void {
		const scheduleOwned =
			schedule.metadata?.wanditScheduleOwner === "period_end_downgrade";
		const orphanOwnedByThisIntent =
			orphanIntent !== undefined &&
			subscription.metadata.wanditScheduleOwner === "period_end_downgrade" &&
			subscription.metadata.wanditScheduleIntent === orphanIntent;

		if (!scheduleOwned && !orphanOwnedByThisIntent) {
			throw new InternalServerErrorException(
				`Stripe subscription ${subscription.id} is controlled by an unmanaged schedule`,
			);
		}
	}

	private async releaseManagedDowngradeSchedule(
		subscription: Stripe.Subscription,
		idempotencyKey: string,
	): Promise<boolean> {
		let priorRemoteMutation = false;

		try {
			const schedule = await this.attachedSchedule(subscription);
			const hasStaleOwnershipMarker =
				subscription.metadata.wanditScheduleOwner === "period_end_downgrade";

			if (!schedule && !hasStaleOwnershipMarker) {
				return false;
			}

			if (!schedule && hasStaleOwnershipMarker) {
				// A prior attempt may have released the schedule before losing the
				// metadata-clear response. Until that cleanup succeeds, this remains
				// a partial remote mutation rather than a terminal rejection.
				priorRemoteMutation = true;
			}

			if (schedule) {
				// Releasing an arbitrary Dashboard/third-party schedule could change
				// what the customer is billed. Only schedule metadata written by this
				// adapter is authoritative for a later upgrade/cancellation.
				this.assertManagedDowngradeSchedule(schedule, subscription);
				await this.stripe().subscriptionSchedules.release(
					schedule.id,
					{},
					{ idempotencyKey },
				);
				priorRemoteMutation = true;
			}

			await this.stripe().subscriptions.update(
				subscription.id,
				{
					metadata: {
						wanditScheduleIntent: "",
						wanditScheduleOwner: "",
						wanditScheduleTarget: "",
					},
				},
				{ idempotencyKey: `${idempotencyKey}:clear-owner` },
			);

			return true;
		} catch (error) {
			this.rethrowPaymentWrite(
				error,
				"Stripe downgrade schedule release ended with an ambiguous write result",
				priorRemoteMutation,
			);
		}
	}

	private async createCheckoutSession(
		params: Stripe.Checkout.SessionCreateParams,
		options: Stripe.RequestOptions,
	): Promise<Stripe.Checkout.Session> {
		try {
			return await this.stripe().checkout.sessions.create(params, options);
		} catch (error) {
			this.rethrowPaymentWrite(
				error,
				"Stripe checkout creation ended with an ambiguous write result",
			);
		}
	}

	private async resolvePriceId(lookupKey: string): Promise<string> {
		const cached = this.priceIdByLookupKey.get(lookupKey);

		if (cached) {
			return cached;
		}

		const prices = await this.stripe().prices.list({
			active: true,
			limit: 1,
			lookup_keys: [lookupKey],
		});
		const [price] = prices.data;

		if (!price) {
			throw new InternalServerErrorException(
				`Stripe price not found for lookup key ${lookupKey}`,
			);
		}

		this.rememberPrice(price);

		return price.id;
	}

	private restrictedPortalConfiguration(): Promise<string> {
		if (env.STRIPE_PORTAL_CONFIGURATION_ID) {
			return Promise.resolve(env.STRIPE_PORTAL_CONFIGURATION_ID);
		}

		if (this.restrictedPortalConfigurationPromise) {
			return this.restrictedPortalConfigurationPromise;
		}

		this.restrictedPortalConfigurationPromise =
			this.findOrCreateRestrictedPortalConfiguration().catch((error) => {
				// Allow a transient Stripe failure to be retried by the next request.
				this.restrictedPortalConfigurationPromise = null;
				throw error;
			});

		return this.restrictedPortalConfigurationPromise;
	}

	private async findOrCreateRestrictedPortalConfiguration(): Promise<string> {
		const configurations = this.stripe().billingPortal.configurations;
		const activeConfigurations = await configurations
			.list({ active: true, limit: 100 })
			.autoPagingToArray({ limit: 10_000 });
		const existing = activeConfigurations.find(
			(configuration) =>
				configuration.name === RESTRICTED_PORTAL_CONFIGURATION_NAME,
		);
		const params = this.restrictedPortalConfigurationParams();

		if (existing) {
			const enforced = await configurations.update(existing.id, params, {
				idempotencyKey: `billing-portal:restricted:v1:enforce:${existing.id}`,
			});

			return enforced.id;
		}

		const created = await configurations.create(params, {
			idempotencyKey: "billing-portal:restricted:v1",
		});

		return created.id;
	}

	private restrictedPortalConfigurationParams(): Stripe.BillingPortal.ConfigurationCreateParams {
		return {
			features: {
				customer_update: { allowed_updates: [], enabled: false },
				invoice_history: { enabled: true },
				payment_method_update: { enabled: true },
				subscription_cancel: {
					enabled: true,
					mode: "at_period_end",
				},
				subscription_update: { enabled: false },
			},
			name: RESTRICTED_PORTAL_CONFIGURATION_NAME,
		};
	}

	private pendingSubscriptionChangeResult(
		subscription: Stripe.Subscription,
	): SubscriptionChangeProviderResult {
		const pendingUpdate = subscription.pending_update;

		if (!pendingUpdate) {
			throw new InternalServerErrorException(
				`Stripe subscription ${subscription.id} has no pending update`,
			);
		}

		const latestInvoice =
			typeof subscription.latest_invoice === "object"
				? subscription.latest_invoice
				: null;

		return {
			...(latestInvoice?.hosted_invoice_url
				? { hostedInvoiceUrl: latestInvoice.hosted_invoice_url }
				: {}),
			outcome: "payment_required",
			pendingExpiresAt: new Date(pendingUpdate.expires_at * 1000),
		};
	}

	private pendingUpdateTargetsPrice(
		subscription: Stripe.Subscription,
		priceId: string,
	): boolean {
		const items = subscription.pending_update?.subscription_items;

		return items?.length === 1 && items[0]?.price.id === priceId;
	}

	private rethrowPaymentWrite(
		error: unknown,
		message: string,
		priorRemoteMutation = false,
	): never {
		if (error instanceof AmbiguousPaymentProviderWriteError) {
			throw error;
		}

		if (
			priorRemoteMutation ||
			error instanceof Stripe.errors.StripeConnectionError ||
			error instanceof Stripe.errors.StripeAPIError
		) {
			throw new AmbiguousPaymentProviderWriteError(message, error);
		}

		throw error;
	}

	private stripe() {
		if (this.client) {
			return this.client;
		}

		const stripeSecretKey = env.STRIPE_SECRET_KEY;

		if (!stripeSecretKey) {
			throw new BillingNotConfiguredError("STRIPE_SECRET_KEY");
		}

		this.client = new Stripe(stripeSecretKey, {
			apiVersion: STRIPE_API_VERSION,
			typescript: true,
		});

		return this.client;
	}

	private rememberPrice(price: Stripe.Price) {
		if (price.lookup_key) {
			this.priceIdByLookupKey.set(price.lookup_key, price.id);
		}

		this.priceLookupKeyById.set(price.id, price.lookup_key);
	}

	private subscriptionMetadata(
		userId: string,
		plan: BillingPlanId,
		tierCredits: CreditTier,
		interval: BillingInterval,
	) {
		return {
			interval,
			plan,
			purpose: CHECKOUT_PURPOSE.subscription,
			tierCredits: String(tierCredits),
			userId,
		};
	}

	private expectUrl(url: string | null, label: string) {
		if (!url) {
			throw new InternalServerErrorException(`${label} did not return a URL`);
		}

		return url;
	}
}
