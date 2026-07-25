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

import { BillingNotConfiguredError } from "../../domain/errors/billing-not-configured.error";
import type {
	CreateOrderCheckoutParams,
	CreateOrderCheckoutResult,
	CreateRefundParams,
	CreateSubscriptionCheckoutParams,
	CreateSubscriptionCheckoutResult,
	CreateTopupCheckoutParams,
	PaymentProvider,
} from "../../domain/ports/payment-provider.port";

const STRIPE_API_VERSION = "2026-02-25.clover";

@Injectable()
export class StripeProvider implements PaymentProvider {
	private readonly priceIdByLookupKey = new Map<string, string>();
	private readonly priceLookupKeyById = new Map<string, string | null>();
	private client: Stripe | null = null;

	async ensureCustomer(userId: string, email: string): Promise<string> {
		const customer = await this.stripe().customers.create(
			{
				email,
				metadata: {
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
		const session = await this.stripe().checkout.sessions.create(
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
		// Checkout Sessions are retryable attempts: an abandoned subscription
		// attempt must be able to create a fresh Session after the preflight.
		const session = await this.stripe().checkout.sessions.create({
			cancel_url: `${env.CORS_ORIGIN}/billing/cancel`,
			client_reference_id: params.userId,
			customer: params.customerId,
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			metadata,
			mode: "subscription",
			subscription_data: {
				metadata,
			},
			success_url: `${env.CORS_ORIGIN}/billing/success?purpose=subscription`,
		});

		return {
			id: session.id,
			url: this.expectUrl(session.url, "Stripe checkout session"),
		};
	}

	async createTopupCheckout(
		params: CreateTopupCheckoutParams,
	): Promise<string> {
		const priceId = await this.resolvePriceId(params.packId);
		const metadata = {
			credits: String(params.credits),
			packId: params.packId,
			purpose: CHECKOUT_PURPOSE.topup,
			userId: params.userId,
		};
		const session = await this.stripe().checkout.sessions.create({
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
		});

		return this.expectUrl(session.url, "Stripe top-up checkout session");
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
		const session = await this.stripe().billingPortal.sessions.create({
			customer: customerId,
			return_url: `${env.CORS_ORIGIN}/dashboard`,
		});

		return this.expectUrl(session.url, "Stripe billing portal session");
	}

	async expireCheckoutSession(sessionId: string): Promise<void> {
		const stripe = this.stripe();
		const session = await stripe.checkout.sessions.retrieve(sessionId);

		if (session.status !== "open") {
			return;
		}

		try {
			await stripe.checkout.sessions.expire(sessionId);
		} catch (error) {
			/*
			 * A customer can complete the Session between the retrieve and expire
			 * calls. Re-read before deciding whether the expiration error is real.
			 */
			const latest = await stripe.checkout.sessions.retrieve(sessionId);

			if (latest.status === "complete" || latest.status === "expired") {
				return;
			}

			throw error;
		}
	}

	async changeSubscription(
		providerSubscriptionId: string,
		newPriceLookupKey: string,
	): Promise<void> {
		const parsed = parsePriceLookupKey(newPriceLookupKey);

		if (!parsed) {
			throw new InternalServerErrorException(
				"Invalid billing price lookup key",
			);
		}

		const stripe = this.stripe();
		const [subscription, priceId] = await Promise.all([
			stripe.subscriptions.retrieve(providerSubscriptionId),
			this.resolvePriceId(newPriceLookupKey),
		]);
		const [subscriptionItem] = subscription.items.data;

		if (!subscriptionItem) {
			throw new InternalServerErrorException(
				"Stripe subscription has no subscription items",
			);
		}

		await stripe.subscriptions.update(providerSubscriptionId, {
			items: [
				{
					id: subscriptionItem.id,
					price: priceId,
				},
			],
			metadata: {
				...subscription.metadata,
				interval: parsed.interval,
				plan: parsed.plan,
				tierCredits: String(parsed.tierCredits),
			},
			proration_behavior: "always_invoice",
		});
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

	async listDisputesForCharge(chargeId: string): Promise<Stripe.Dispute[]> {
		const disputes = await this.stripe().disputes.list({
			charge: chargeId,
			limit: 100,
		});

		return disputes.data;
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
