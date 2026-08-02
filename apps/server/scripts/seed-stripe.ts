import { createHash } from "node:crypto";

import {
	billingPlanIds,
	CREDIT_TIERS,
	priceLookupKey,
	priceUsdFor,
	TOPUP_PACKS,
	topupPackIds,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import Stripe from "stripe";

import { replaceStripePriceSafely } from "../src/modules/billing/infrastructure/stripe/stripe-price-replacement";

const STRIPE_API_VERSION = "2026-02-25.clover";
const CURRENCY = "usd";

type SummaryAction = "created" | "existing" | "replaced";

type SummaryRow = {
	action: SummaryAction;
	amountUsd?: string;
	id: string;
	key: string;
	type: "price" | "product";
};

if (!env.STRIPE_SECRET_KEY) {
	throw new Error(
		"STRIPE_SECRET_KEY is required to seed Stripe billing prices",
	);
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
	apiVersion: STRIPE_API_VERSION,
	typescript: true,
});

const summary: SummaryRow[] = [];

async function main() {
	const planProducts = new Map<string, Stripe.Product>();

	for (const planId of billingPlanIds) {
		const product = await ensureProduct(planId, `Wandit ${titleCase(planId)}`);
		planProducts.set(planId, product);
	}

	const topupProduct = await ensureProduct("topup", "Wandit Top-up Credits");

	for (const planId of billingPlanIds) {
		const product = planProducts.get(planId);

		if (!product) {
			throw new Error(`Missing product for plan ${planId}`);
		}

		for (const tierCredits of CREDIT_TIERS) {
			for (const interval of ["month", "year"] as const) {
				const lookupKey = priceLookupKey(planId, tierCredits, interval);
				const unitAmount = Math.round(
					priceUsdFor(planId, tierCredits, interval) * 100,
				);

				await ensurePrice({
					lookupKey,
					metadata: {
						credits: String(tierCredits),
						interval,
						plan: planId,
						tierCredits: String(tierCredits),
					},
					nickname: `${titleCase(planId)} ${tierCredits} credits / ${interval}`,
					productId: product.id,
					recurring: {
						interval,
					},
					unitAmount,
				});
			}
		}
	}

	for (const packId of topupPackIds) {
		const pack = TOPUP_PACKS[packId];

		await ensurePrice({
			lookupKey: packId,
			metadata: {
				credits: String(pack.credits),
				packId,
			},
			nickname: `${pack.credits} top-up credits`,
			productId: topupProduct.id,
			unitAmount: Math.round(pack.usd * 100),
		});
	}

	console.table(summary);
}

async function ensureProduct(planId: string, name: string) {
	for await (const product of stripe.products.list({ limit: 100 })) {
		if (product.active && product.metadata.planId === planId) {
			summary.push({
				action: "existing",
				id: product.id,
				key: planId,
				type: "product",
			});

			return product;
		}
	}

	const product = await stripe.products.create({
		metadata: {
			planId,
		},
		name,
	});

	summary.push({
		action: "created",
		id: product.id,
		key: planId,
		type: "product",
	});

	return product;
}

async function ensurePrice(input: {
	lookupKey: string;
	metadata: Stripe.MetadataParam;
	nickname: string;
	productId: string;
	recurring?: Stripe.PriceCreateParams.Recurring;
	unitAmount: number;
}) {
	const existingPrice = await findPriceByLookupKey(input.lookupKey);

	if (existingPrice && existingPriceMatches(existingPrice, input)) {
		summary.push({
			action: "existing",
			amountUsd: dollars(input.unitAmount),
			id: existingPrice.id,
			key: input.lookupKey,
			type: "price",
		});

		return existingPrice;
	}

	const createParams: Stripe.PriceCreateParams = {
		currency: CURRENCY,
		lookup_key: input.lookupKey,
		metadata: input.metadata,
		nickname: input.nickname,
		product: input.productId,
		...(input.recurring ? { recurring: input.recurring } : {}),
		unit_amount: input.unitAmount,
	};
	const price = existingPrice
		? await replaceStripePriceSafely(
				stripe,
				existingPrice,
				createParams,
				replacementIdempotencyKey(existingPrice.id, input),
			)
		: await stripe.prices.create(createParams);

	summary.push({
		action: existingPrice ? "replaced" : "created",
		amountUsd: dollars(input.unitAmount),
		id: price.id,
		key: input.lookupKey,
		type: "price",
	});

	return price;
}

async function findPriceByLookupKey(lookupKey: string) {
	for (const active of [true, false]) {
		const [price] = (
			await stripe.prices.list({
				active,
				expand: ["data.product"],
				limit: 1,
				lookup_keys: [lookupKey],
			})
		).data;

		if (price) {
			return price;
		}
	}

	return undefined;
}

function replacementIdempotencyKey(
	existingPriceId: string,
	input: {
		lookupKey: string;
		metadata: Stripe.MetadataParam;
		productId: string;
		recurring?: Stripe.PriceCreateParams.Recurring;
		unitAmount: number;
	},
) {
	const fingerprint = createHash("sha256")
		.update(
			JSON.stringify({
				interval: input.recurring?.interval ?? null,
				lookupKey: input.lookupKey,
				metadata: Object.fromEntries(Object.entries(input.metadata).sort()),
				productId: input.productId,
				unitAmount: input.unitAmount,
			}),
		)
		.digest("hex");

	return `billing-seed:replace:${existingPriceId}:${fingerprint}`;
}

function existingPriceMatches(
	price: Stripe.Price,
	input: {
		metadata: Stripe.MetadataParam;
		productId: string;
		recurring?: Stripe.PriceCreateParams.Recurring;
		unitAmount: number;
	},
) {
	const productMatches =
		typeof price.product !== "string" &&
		"active" in price.product &&
		price.product.active &&
		price.product.id === input.productId;
	const recurringInterval = price.recurring?.interval ?? null;
	const expectedInterval = input.recurring?.interval ?? null;
	const recurringIntervalCount = price.recurring?.interval_count ?? null;
	const expectedIntervalCount = input.recurring ? 1 : null;

	return (
		price.active === true &&
		price.unit_amount === input.unitAmount &&
		price.currency.toLowerCase() === CURRENCY &&
		productMatches &&
		recurringInterval === expectedInterval &&
		recurringIntervalCount === expectedIntervalCount &&
		Object.entries(input.metadata).every(
			([key, value]) => price.metadata[key] === String(value),
		)
	);
}

function dollars(cents: number) {
	return `$${(cents / 100).toFixed(2)}`;
}

function titleCase(value: string) {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

await main();
