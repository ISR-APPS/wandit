import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { replaceStripePriceSafely } from "./stripe-price-replacement";

function setup(
	subscriptionPages: Array<Partial<Stripe.ApiList<Stripe.Subscription>>>,
) {
	const calls: string[] = [];
	const replacement = { id: "price_new" } as Stripe.Price;
	const prices = {
		create: vi.fn(async () => {
			calls.push("create");
			return replacement;
		}),
		update: vi.fn(async (_id: string, params: Stripe.PriceUpdateParams) => {
			calls.push(params.active ? "reactivate" : "deactivate");
			return { id: "price_old" } as Stripe.Price;
		}),
	};
	const subscriptions = {
		list: vi.fn(async () => {
			calls.push("list");
			const page = subscriptionPages.shift() ?? { data: [], has_more: false };
			return {
				data: page.data ?? [],
				has_more: page.has_more ?? false,
			};
		}),
	};
	const stripe = { prices, subscriptions } as unknown as Pick<
		Stripe,
		"prices" | "subscriptions"
	>;

	return { calls, prices, replacement, stripe, subscriptions };
}

const CREATE_PARAMS: Stripe.PriceCreateParams = {
	currency: "usd",
	lookup_key: "pro_100_month",
	product: "prod_pro",
	recurring: { interval: "month" },
	unit_amount: 2_500,
};
const OLD_RECURRING_PRICE = {
	id: "price_old",
	recurring: { interval: "month" },
} as Pick<Stripe.Price, "id" | "recurring">;

describe("replaceStripePriceSafely", () => {
	it("deactivates an unused old price before idempotently transferring its lookup key", async () => {
		const { calls, prices, replacement, stripe, subscriptions } = setup([
			{ data: [], has_more: false },
			{ data: [], has_more: false },
		]);

		await expect(
			replaceStripePriceSafely(
				stripe,
				OLD_RECURRING_PRICE,
				CREATE_PARAMS,
				"billing-seed:replace:fingerprint",
			),
		).resolves.toBe(replacement);

		expect(calls).toEqual(["list", "deactivate", "list", "create"]);
		expect(subscriptions.list).toHaveBeenNthCalledWith(1, {
			limit: 100,
			price: "price_old",
			status: "all",
		});
		expect(prices.create).toHaveBeenCalledWith(
			{ ...CREATE_PARAMS, transfer_lookup_key: true },
			{ idempotencyKey: "billing-seed:replace:fingerprint" },
		);
	});

	it("refuses to alter a price attached to a non-terminal subscription", async () => {
		const activeSubscription = {
			id: "sub_live",
			status: "active",
		} as Stripe.Subscription;
		const { calls, prices, stripe } = setup([
			{ data: [activeSubscription], has_more: false },
		]);

		await expect(
			replaceStripePriceSafely(
				stripe,
				OLD_RECURRING_PRICE,
				CREATE_PARAMS,
				"billing-seed:replace:fingerprint",
			),
		).rejects.toThrow("subscription sub_live has non-terminal status active");

		expect(calls).toEqual(["list"]);
		expect(prices.update).not.toHaveBeenCalled();
		expect(prices.create).not.toHaveBeenCalled();
	});

	it("reactivates the old price if a subscription races the replacement guard", async () => {
		const racedSubscription = {
			id: "sub_raced",
			status: "trialing",
		} as Stripe.Subscription;
		const { calls, prices, stripe } = setup([
			{ data: [], has_more: false },
			{ data: [racedSubscription], has_more: false },
		]);

		await expect(
			replaceStripePriceSafely(
				stripe,
				OLD_RECURRING_PRICE,
				CREATE_PARAMS,
				"billing-seed:replace:fingerprint",
			),
		).rejects.toThrow(
			"subscription sub_raced has non-terminal status trialing",
		);

		expect(calls).toEqual(["list", "deactivate", "list", "reactivate"]);
		expect(prices.create).not.toHaveBeenCalled();
	});

	it("deactivates a one-time top-up price without an inapplicable subscription query", async () => {
		const { calls, prices, replacement, stripe, subscriptions } = setup([]);

		await expect(
			replaceStripePriceSafely(
				stripe,
				{ id: "price_topup_old", recurring: null },
				{
					currency: "usd",
					lookup_key: "topup_100",
					product: "prod_topup",
					unit_amount: 2_500,
				},
				"billing-seed:replace:topup-fingerprint",
			),
		).resolves.toBe(replacement);

		expect(calls).toEqual(["deactivate", "create"]);
		expect(subscriptions.list).not.toHaveBeenCalled();
		expect(prices.update).toHaveBeenCalledWith("price_topup_old", {
			active: false,
		});
	});
});
