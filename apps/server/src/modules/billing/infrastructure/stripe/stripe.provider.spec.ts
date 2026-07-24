import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { StripeProvider } from "./stripe.provider";

type StripeClientSlot = {
	client: Stripe | null;
};

function setup() {
	const customersCreate = vi.fn(
		async (
			_params: Stripe.CustomerCreateParams,
			_options?: Stripe.RequestOptions,
		) => ({ id: "cus_1" }) as Stripe.Customer,
	);
	const sessionsCreate = vi.fn(
		async (
			_params: Stripe.Checkout.SessionCreateParams,
			_options?: Stripe.RequestOptions,
		) =>
			({
				id: "cs_1",
				url: "https://checkout.stripe.test/cs_1",
			}) as Stripe.Checkout.Session,
	);
	const sessionsExpire = vi.fn(
		async (_sessionId: string) =>
			({
				id: "cs_1",
				status: "expired",
			}) as Stripe.Checkout.Session,
	);
	const sessionsRetrieve = vi.fn(
		async (_sessionId: string) =>
			({
				id: "cs_1",
				status: "open",
			}) as Stripe.Checkout.Session,
	);
	const pricesList = vi.fn(
		async (_params: Stripe.PriceListParams) =>
			({
				data: [{ id: "price_1", lookup_key: "lookup_key" }],
			}) as Stripe.ApiList<Stripe.Price>,
	);
	const refundsCreate = vi.fn(
		async (
			_params: Stripe.RefundCreateParams,
			_options?: Stripe.RequestOptions,
		) =>
			({
				id: "re_1",
				object: "refund",
				status: "pending",
			}) as Stripe.Refund,
	);
	const chargesRetrieve = vi.fn(
		async (_chargeId: string, _params?: Stripe.ChargeRetrieveParams) =>
			({
				id: "ch_1",
				object: "charge",
				refunds: {
					data: [],
					has_more: false,
					object: "list",
					url: "/v1/charges/ch_1/refunds",
				},
			}) as unknown as Stripe.Charge,
	);
	const stripe = {
		charges: {
			retrieve: chargesRetrieve,
		},
		checkout: {
			sessions: {
				create: sessionsCreate,
				expire: sessionsExpire,
				retrieve: sessionsRetrieve,
			},
		},
		customers: {
			create: customersCreate,
		},
		prices: {
			list: pricesList,
		},
		refunds: {
			create: refundsCreate,
		},
	} as unknown as Stripe;
	const provider = new StripeProvider();
	(provider as unknown as StripeClientSlot).client = stripe;

	return {
		chargesRetrieve,
		customersCreate,
		pricesList,
		provider,
		refundsCreate,
		sessionsCreate,
		sessionsExpire,
		sessionsRetrieve,
	};
}

describe("StripeProvider", () => {
	it("creates customers with the exact per-user idempotency key", async () => {
		const { customersCreate, provider } = setup();

		await expect(
			provider.ensureCustomer("user_1", "user@example.com"),
		).resolves.toBe("cus_1");
		expect(customersCreate).toHaveBeenCalledWith(
			{
				email: "user@example.com",
				metadata: {
					userId: "user_1",
				},
			},
			{
				idempotencyKey: "customer:user_1",
			},
		);
	});

	it("sets subscription purpose without checkout idempotency", async () => {
		const { pricesList, provider, sessionsCreate } = setup();

		await expect(
			provider.createSubscriptionCheckout({
				customerId: "cus_1",
				email: "user@example.com",
				interval: "month",
				plan: "pro",
				tierCredits: 100,
				userId: "user_1",
			}),
		).resolves.toEqual({
			id: "cs_1",
			url: "https://checkout.stripe.test/cs_1",
		});

		expect(pricesList).toHaveBeenCalledWith({
			active: true,
			limit: 1,
			lookup_keys: ["pro_100_month"],
		});
		expect(sessionsCreate.mock.calls[0]).toHaveLength(1);
		expect(sessionsCreate.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				cancel_url: "http://web.test/billing/cancel",
				customer: "cus_1",
				metadata: expect.objectContaining({
					purpose: "subscription",
					userId: "user_1",
				}),
				mode: "subscription",
				success_url: "http://web.test/billing/success?purpose=subscription",
			}),
		);
	});

	it("expires an open subscription checkout session", async () => {
		const { provider, sessionsExpire, sessionsRetrieve } = setup();

		await provider.expireCheckoutSession("cs_1");

		expect(sessionsRetrieve).toHaveBeenCalledOnce();
		expect(sessionsRetrieve).toHaveBeenCalledWith("cs_1");
		expect(sessionsExpire).toHaveBeenCalledOnce();
		expect(sessionsExpire).toHaveBeenCalledWith("cs_1");
	});

	it.each([
		"complete",
		"expired",
	] as const)("tolerates an already-%s checkout session", async (status) => {
		const { provider, sessionsExpire, sessionsRetrieve } = setup();
		sessionsRetrieve.mockResolvedValueOnce({
			id: "cs_1",
			status,
		} as Stripe.Checkout.Session);

		await expect(
			provider.expireCheckoutSession("cs_1"),
		).resolves.toBeUndefined();
		expect(sessionsExpire).not.toHaveBeenCalled();
	});

	it("tolerates completion racing the expiration request", async () => {
		const { provider, sessionsExpire, sessionsRetrieve } = setup();
		sessionsExpire.mockRejectedValueOnce(
			new Error("Session is no longer open"),
		);
		sessionsRetrieve
			.mockResolvedValueOnce({
				id: "cs_1",
				status: "open",
			} as Stripe.Checkout.Session)
			.mockResolvedValueOnce({
				id: "cs_1",
				status: "complete",
			} as Stripe.Checkout.Session);

		await expect(
			provider.expireCheckoutSession("cs_1"),
		).resolves.toBeUndefined();
		expect(sessionsRetrieve).toHaveBeenCalledTimes(2);
		expect(sessionsExpire).toHaveBeenCalledOnce();
	});

	it("sets explicit top-up purpose metadata", async () => {
		const { pricesList, provider, sessionsCreate } = setup();

		await expect(
			provider.createTopupCheckout({
				credits: 500,
				customerId: "cus_1",
				packId: "topup_500",
				userId: "user_1",
			}),
		).resolves.toBe("https://checkout.stripe.test/cs_1");

		expect(pricesList).toHaveBeenCalledWith({
			active: true,
			limit: 1,
			lookup_keys: ["topup_500"],
		});
		expect(sessionsCreate.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				cancel_url: "http://web.test/billing/cancel",
				metadata: {
					credits: "500",
					packId: "topup_500",
					purpose: "topup",
					userId: "user_1",
				},
				mode: "payment",
				payment_intent_data: {
					metadata: {
						credits: "500",
						packId: "topup_500",
						purpose: "topup",
						userId: "user_1",
					},
				},
				success_url: "http://web.test/billing/success?purpose=topup",
			}),
		);
	});

	it("returns the created refund while preserving the order idempotency key", async () => {
		const { provider, refundsCreate } = setup();

		await expect(
			provider.createRefund({
				idempotencyKey: "order-refund:order_1",
				paymentIntentId: "pi_order_1",
			}),
		).resolves.toMatchObject({
			id: "re_1",
			status: "pending",
		});
		expect(refundsCreate).toHaveBeenCalledWith(
			{ payment_intent: "pi_order_1" },
			{ idempotencyKey: "order-refund:order_1" },
		);
	});

	it("retrieves charges with their refund objects expanded", async () => {
		const { chargesRetrieve, provider } = setup();

		await expect(provider.retrieveCharge("ch_1")).resolves.toMatchObject({
			id: "ch_1",
		});
		expect(chargesRetrieve).toHaveBeenCalledWith("ch_1", {
			expand: ["refunds"],
		});
	});
});
