import { Injectable, InternalServerErrorException } from "@nestjs/common";
import {
	type BillingInterval,
	type BillingPlanId,
	type CreditTier,
	parsePriceLookupKey,
	priceLookupKey,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import Stripe from "stripe";

import { BillingNotConfiguredError } from "../../domain/errors/billing-not-configured.error";
import type {
	CreateSubscriptionCheckoutParams,
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
		const customer = await this.stripe().customers.create({
			email,
			metadata: {
				userId,
			},
		});

		return customer.id;
	}

	async createSubscriptionCheckout(
		params: CreateSubscriptionCheckoutParams,
	): Promise<string> {
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
		const session = await this.stripe().checkout.sessions.create({
			cancel_url: `${env.CORS_ORIGIN}/dashboard?billing=cancelled`,
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
			success_url: `${env.CORS_ORIGIN}/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
		});

		return this.expectUrl(session.url, "Stripe checkout session");
	}

	async createTopupCheckout(
		params: CreateTopupCheckoutParams,
	): Promise<string> {
		const priceId = await this.resolvePriceId(params.packId);
		const session = await this.stripe().checkout.sessions.create({
			cancel_url: `${env.CORS_ORIGIN}/dashboard?billing=cancelled`,
			customer: params.customerId,
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			metadata: {
				credits: String(params.credits),
				packId: params.packId,
				userId: params.userId,
			},
			mode: "payment",
			success_url: `${env.CORS_ORIGIN}/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}`,
		});

		return this.expectUrl(session.url, "Stripe top-up checkout session");
	}

	async createPortalSession(customerId: string): Promise<string> {
		const session = await this.stripe().billingPortal.sessions.create({
			customer: customerId,
			return_url: `${env.CORS_ORIGIN}/dashboard`,
		});

		return this.expectUrl(session.url, "Stripe billing portal session");
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
				"payments.data.payment.payment_intent",
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
