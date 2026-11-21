/**
 * Stripe adapter of billing: customers, top-up and order checkouts, refunds, and reads.
 * The v6 subscription writes stay for scripts/migrate-subscriptions-v6.ts and the admin refund.
 * Billing, orders, and affiliates services call it, often through the PAYMENT_PROVIDER port.
 * Calls the Stripe API. Wraps write failures with an unknown result in AmbiguousPaymentProviderWriteError.
 */
import {
	Injectable,
	InternalServerErrorException,
	Logger,
} from "@nestjs/common";
import { CHECKOUT_PURPOSE, parsePriceLookupKey } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import Stripe from "stripe";

import { AmbiguousPaymentProviderWriteError } from "../../domain/errors/ambiguous-payment-provider-write.error";
import { BillingNotConfiguredError } from "../../domain/errors/billing-not-configured.error";
import type {
	CreateCheckoutSessionResult,
	CreateOrderCheckoutParams,
	CreateRefundParams,
	CreateTopupCheckoutParams,
	PaymentProvider,
	ScheduleSubscriptionDowngradeParams,
	SwitchSubscriptionPriceWithoutProrationParams,
} from "../../domain/ports/payment-provider.port";
import { STRIPE_API_VERSION } from "./stripe.constants";

const RESTRICTED_PORTAL_CONFIGURATION_NAME =
	"Wandit restricted billing portal v2";

@Injectable()
export class StripeProvider implements PaymentProvider {
	private readonly logger = new Logger(StripeProvider.name);
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

	async ensureOrganizationCustomer(params: {
		affiliateCode?: string | null;
		attributionUserId: string;
		billingEmail: string;
		createdByUserId: string;
		organizationId: string;
		organizationName: string;
	}): Promise<string> {
		const customer = await this.stripe().customers.create(
			{
				email: params.billingEmail,
				name: params.organizationName,
				metadata: {
					...(params.affiliateCode
						? { affiliateCode: params.affiliateCode }
						: {}),
					// Affiliate commissions on this org's invoices follow the
					// attribution user (the org's creator), never the checkout actor.
					attributionUserId: params.attributionUserId,
					createdByUserId: params.createdByUserId,
					organizationId: params.organizationId,
				},
			},
			{
				idempotencyKey: `customer:org:${params.organizationId}`,
			},
		);

		return customer.id;
	}

	async createOrderCheckout(
		params: CreateOrderCheckoutParams,
	): Promise<CreateCheckoutSessionResult> {
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

	/**
	 * Creates the Checkout Session of a wallet top-up: one card payment in USD.
	 * BillingService passes values from the attempt row only. No clock value goes in,
	 * so a replay with the same idempotency key sends the same bytes.
	 */
	async createTopupCheckout(
		params: CreateTopupCheckoutParams,
	): Promise<CreateCheckoutSessionResult> {
		// The webhook takes the credits from the attempt row, so the metadata holds no amount.
		const metadata = {
			attemptId: params.attemptId,
			...(params.organizationId
				? { organizationId: params.organizationId }
				: {}),
			purpose: CHECKOUT_PURPOSE.topup,
			userId: params.userId,
		};
		// English digits with commas, as the product name is English: "1,100 credits".
		const numberFormat = new Intl.NumberFormat("en-US");
		const totalCredits = params.baseCredits + params.bonusCredits;
		// The payer sees the bonus split only when the amount reaches a bonus tier.
		const description =
			params.bonusCredits > 0
				? `${numberFormat.format(totalCredits)} credits (${numberFormat.format(params.baseCredits)} + ${numberFormat.format(params.bonusCredits)} bonus)`
				: `${numberFormat.format(totalCredits)} credits`;
		const session = await this.createCheckoutSession(
			{
				// Off: the webhook compares amount_subtotal in USD cents with the attempt row.
				adaptive_pricing: { enabled: false },
				cancel_url: `${env.CORS_ORIGIN}/billing/cancel`,
				customer: params.customerId,
				line_items: [
					{
						price_data: {
							currency: "usd",
							product_data: { description, name: "Wandit credits" },
							unit_amount: params.amountUsdCents,
						},
						quantity: 1,
					},
				],
				metadata,
				mode: "payment",
				// Refund retries read `purpose` from the payment intent (checkoutPurposeForCharge).
				payment_intent_data: { metadata },
				// Cards only: a delayed method completes the session unpaid and blocks the owner for days.
				payment_method_types: ["card"],
				// Card testers try stolen cards on the $1 Starter pass. 3-D Secure on each card stops them.
				...(params.requestThreeDSecure
					? {
							payment_method_options: {
								card: { request_three_d_secure: "any" as const },
							},
						}
					: {}),
				success_url: `${env.CORS_ORIGIN}/billing/success?purpose=topup&session_id={CHECKOUT_SESSION_ID}`,
			},
			{
				idempotencyKey: params.organizationId
					? `topup-checkout:org:${params.organizationId}:${params.attemptId}`
					: `topup-checkout:${params.userId}:${params.attemptId}`,
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

	async switchSubscriptionPriceWithoutProration(
		params: SwitchSubscriptionPriceWithoutProrationParams,
	): Promise<void> {
		const stripe = this.stripe();
		const [subscription, priceId] = await Promise.all([
			stripe.subscriptions.retrieve(params.providerSubscriptionId),
			this.resolvePriceId(params.newPriceLookupKey),
		]);
		const [item, unexpectedItem] = subscription.items.data;

		if (!item || unexpectedItem) {
			throw new InternalServerErrorException(
				`Stripe subscription ${subscription.id} must have exactly one subscription item`,
			);
		}

		if (subscription.pending_update) {
			throw new InternalServerErrorException(
				`Stripe subscription ${subscription.id} has a pending update`,
			);
		}

		if (
			item.price.id !== priceId &&
			item.price.lookup_key !== params.currentPriceLookupKey
		) {
			throw new InternalServerErrorException(
				`Stripe subscription ${subscription.id} has price ${item.price.lookup_key ?? "<missing>"}, expected ${params.currentPriceLookupKey}`,
			);
		}

		if (item.price.id === priceId) {
			return;
		}

		await stripe.subscriptions.update(
			params.providerSubscriptionId,
			{
				items: [{ id: item.id, price: priceId }],
				proration_behavior: "none",
			},
			{ idempotencyKey: params.idempotencyKey },
		);
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
			const [item, unexpectedItem] = subscription.items.data;

			if (!item || unexpectedItem) {
				throw new InternalServerErrorException(
					`Stripe subscription ${subscription.id} must have exactly one subscription item`,
				);
			}

			if (item.price.lookup_key !== params.currentPriceLookupKey) {
				throw new InternalServerErrorException(
					`Stripe subscription ${subscription.id} has price ${item.price.lookup_key ?? "<missing>"}, expected ${params.currentPriceLookupKey}`,
				);
			}

			if (subscription.cancel_at_period_end) {
				throw new InternalServerErrorException(
					`Stripe subscription ${subscription.id} is set to cancel at period end`,
				);
			}

			if (
				subscription.status !== "active" &&
				subscription.status !== "trialing"
			) {
				throw new InternalServerErrorException(
					`Stripe subscription ${subscription.id} has non-entitled status ${subscription.status}`,
				);
			}

			if (subscription.pending_update) {
				throw new InternalServerErrorException(
					`Stripe subscription ${subscription.id} has a pending update`,
				);
			}

			let schedule = await this.attachedSchedule(subscription);

			if (schedule) {
				this.assertManagedDowngradeSchedule(
					schedule,
					subscription,
					params.idempotencyKey,
				);

				const replaysCurrentSchedulingAttempt =
					(schedule.metadata?.wanditScheduleIntent === params.idempotencyKey &&
						schedule.metadata.wanditScheduleTarget ===
							params.newPriceLookupKey) ||
					(subscription.metadata.wanditScheduleOwner ===
						"period_end_downgrade" &&
						subscription.metadata.wanditScheduleIntent ===
							params.idempotencyKey &&
						subscription.metadata.wanditScheduleTarget ===
							params.newPriceLookupKey);

				if (
					params.expectedScheduleTarget === null &&
					(!params.allowSameIntentRecovery || !replaysCurrentSchedulingAttempt)
				) {
					throw new InternalServerErrorException(
						`Stripe subscription ${subscription.id} has an attached downgrade schedule, but no schedule was expected`,
					);
				}

				if (
					params.expectedScheduleTarget !== null &&
					schedule.metadata?.wanditScheduleTarget !==
						params.expectedScheduleTarget
				) {
					throw new InternalServerErrorException(
						`Stripe subscription schedule ${schedule.id} targets ${schedule.metadata?.wanditScheduleTarget ?? "<missing>"}, expected ${params.expectedScheduleTarget}`,
					);
				}
				// An attached application-owned schedule is durable partial state
				// from this intent or an earlier pending downgrade. Do not terminalize
				// the intent if a later configure step fails.
				priorRemoteMutation = true;
			} else {
				if (params.expectedScheduleTarget !== null) {
					throw new InternalServerErrorException(
						`Stripe subscription ${subscription.id} has no attached downgrade schedule, expected ${params.expectedScheduleTarget}`,
					);
				}

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

	/**
	 * Ends a Stripe subscription now, with no proration credit and no final invoice.
	 * AdminUserRefundsService calls it after an admin refund. A call on an ended subscription does nothing.
	 * The customer.subscription.deleted webhook then updates the local subscription row.
	 */
	async cancelSubscriptionNow(
		providerSubscriptionId: string,
		idempotencyKey: string,
	): Promise<void> {
		let priorRemoteMutation = false;

		try {
			const subscription = await this.stripe().subscriptions.retrieve(
				providerSubscriptionId,
			);

			// A retry after a partial failure finds the subscription ended already.
			if (
				subscription.status === "canceled" ||
				subscription.status === "incomplete_expired"
			) {
				return;
			}

			// An attached schedule owns cancellation behavior. Release our managed
			// downgrade schedule first.
			priorRemoteMutation = await this.releaseManagedDowngradeSchedule(
				subscription,
				`${idempotencyKey}:release-schedule`,
			);

			await this.stripe().subscriptions.cancel(
				providerSubscriptionId,
				{ invoice_now: false, prorate: false },
				{ idempotencyKey },
			);
		} catch (error) {
			this.rethrowPaymentWrite(
				error,
				"Stripe immediate subscription cancellation ended with an ambiguous write result",
				priorRemoteMutation,
			);
		}
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

	async retrieveInvoice(invoiceId: string): Promise<Stripe.Invoice> {
		try {
			return await this.stripe().invoices.retrieve(invoiceId, {
				// Stripe caps expansion depth at 4 levels — expanding the payment
				// intent's latest_charge on top of payments.data.payment exceeds it
				// and Stripe rejects the whole retrieve. Every consumer accepts
				// unexpanded ID strings, so stop at the payment intent.
				expand: [
					"lines.data.pricing.price_details.price",
					"parent.subscription_details.subscription",
					"payments.data.payment.payment_intent",
				],
			});
		} catch (error) {
			if (!this.isExpansionRejection(error)) {
				throw error;
			}

			// Keep only the subscription expansion (owner attribution needs its
			// metadata); lines and payments resolve through per-ID fallbacks.
			this.logger.warn(
				`Stripe rejected invoice ${invoiceId} expansions; retrying with the minimal set`,
			);

			return this.stripe().invoices.retrieve(invoiceId, {
				expand: ["parent.subscription_details.subscription"],
			});
		}
	}

	async listInvoicePayments(
		invoiceId: string,
	): Promise<Stripe.InvoicePayment[]> {
		return this.stripe()
			.invoicePayments.list({
				expand: ["data.payment.payment_intent"],
				invoice: invoiceId,
				limit: 100,
				status: "paid",
			})
			.autoPagingToArray({ limit: 10_000 });
	}

	private isExpansionRejection(error: unknown): boolean {
		return (
			error instanceof Stripe.errors.StripeInvalidRequestError &&
			(error.param?.startsWith("expand") === true ||
				error.message.includes("expand"))
		);
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

	retrieveDispute(disputeId: string): Promise<Stripe.Dispute> {
		return this.stripe().disputes.retrieve(disputeId);
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
		const subscriptions: Stripe.Subscription[] = [];
		const pages = this.stripe().subscriptions.list({
			customer: providerCustomerId,
			expand: ["data.default_payment_method"],
			limit: 100,
			status: "all",
		});

		// The subscription sync must see older active subscriptions,
		// even when newer canceled attempts fill the first page of Stripe history.
		for await (const subscription of pages) {
			subscriptions.push(subscription);
		}

		return subscriptions;
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
			const scheduleScopedIdempotencyKey = schedule
				? `${idempotencyKey}:${schedule.id}`
				: idempotencyKey;
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
					{ idempotencyKey: scheduleScopedIdempotencyKey },
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
				{ idempotencyKey: `${scheduleScopedIdempotencyKey}:clear-owner` },
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
		if (this.restrictedPortalConfigurationPromise) {
			return this.restrictedPortalConfigurationPromise;
		}

		const configurationPromise = env.STRIPE_PORTAL_CONFIGURATION_ID
			? this.enforceRestrictedPortalConfiguration(
					env.STRIPE_PORTAL_CONFIGURATION_ID,
				)
			: this.findOrCreateRestrictedPortalConfiguration();
		this.restrictedPortalConfigurationPromise = configurationPromise.catch(
			(error) => {
				// Allow a transient Stripe failure to be retried by the next request.
				this.restrictedPortalConfigurationPromise = null;
				throw error;
			},
		);

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
			return this.enforceRestrictedPortalConfiguration(existing.id);
		}

		const created = await configurations.create(params, {
			idempotencyKey: "billing-portal:restricted:v2",
		});

		return created.id;
	}

	private async enforceRestrictedPortalConfiguration(
		configurationId: string,
	): Promise<string> {
		const enforced = await this.stripe().billingPortal.configurations.update(
			configurationId,
			this.restrictedPortalConfigurationParams(),
			{
				idempotencyKey: `billing-portal:restricted:v2:enforce:${configurationId}`,
			},
		);

		return enforced.id;
	}

	private restrictedPortalConfigurationParams(): Stripe.BillingPortal.ConfigurationCreateParams {
		return {
			features: {
				customer_update: { allowed_updates: [], enabled: false },
				invoice_history: { enabled: true },
				payment_method_update: { enabled: true },
				subscription_cancel: { enabled: false },
				subscription_update: { enabled: false },
			},
			name: RESTRICTED_PORTAL_CONFIGURATION_NAME,
		};
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

	private expectUrl(url: string | null, label: string) {
		if (!url) {
			throw new InternalServerErrorException(`${label} did not return a URL`);
		}

		return url;
	}
}
