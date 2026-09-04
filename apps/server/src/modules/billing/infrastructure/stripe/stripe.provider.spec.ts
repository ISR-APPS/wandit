import { env } from "@wandit/env/server";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { AmbiguousPaymentProviderWriteError } from "../../domain/errors/ambiguous-payment-provider-write.error";
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
	const invoicePaymentsAutoPagingToArray = vi.fn(
		async () => [] as Stripe.InvoicePayment[],
	);
	const invoicePaymentsList = vi.fn(() => ({
		autoPagingToArray: invoicePaymentsAutoPagingToArray,
	}));
	const subscription = {
		cancel_at_period_end: false,
		id: "sub_1",
		metadata: {},
		items: {
			data: [
				{
					current_period_end: 1_780_000_000,
					current_period_start: 1_777_321_600,
					id: "si_1",
					price: { id: "price_old", lookup_key: "pro_250_month" },
					quantity: 1,
				},
			],
		},
		latest_invoice: null,
		pending_update: null,
		schedule: null,
		status: "active",
	} as unknown as Stripe.Subscription;
	const subscriptionsRetrieve = vi.fn(async () => subscription);
	const subscriptionPages: Stripe.Subscription[][] = [];
	const subscriptionsList = vi.fn((_params: Stripe.SubscriptionListParams) => ({
		data: subscriptionPages[0] ?? [],
		async *[Symbol.asyncIterator]() {
			for (const page of subscriptionPages) {
				yield* page;
			}
		},
	}));
	const subscriptionsUpdate = vi.fn(
		async (
			_id: string,
			_params: Stripe.SubscriptionUpdateParams,
			_options?: Stripe.RequestOptions,
		) => subscription,
	);
	const invoicesCreatePreview = vi.fn(
		async () => ({ amount_due: 2_500, currency: "usd" }) as Stripe.Invoice,
	);
	const portalConfigurationsCreate = vi.fn(
		async () =>
			({ id: "bpc_restricted" }) as Stripe.BillingPortal.Configuration,
	);
	const portalConfigurationsAutoPagingToArray = vi.fn(
		async () => [] as Stripe.BillingPortal.Configuration[],
	);
	const portalConfigurationsList = vi.fn(() => ({
		autoPagingToArray: portalConfigurationsAutoPagingToArray,
	}));
	const portalConfigurationsUpdate = vi.fn(
		async (id: string) => ({ id }) as Stripe.BillingPortal.Configuration,
	);
	const portalSessionsCreate = vi.fn(
		async () =>
			({
				id: "bps_1",
				url: "https://billing.stripe.test/session",
			}) as Stripe.BillingPortal.Session,
	);
	const subscriptionSchedule = {
		current_phase: {
			end_date: 1_780_000_000,
			start_date: 1_777_321_600,
		},
		id: "sub_sched_1",
		metadata: {
			wanditScheduleIntent: "sub-change:user_1:intent_1",
			wanditScheduleOwner: "period_end_downgrade",
			wanditScheduleTarget: "pro_250_month",
		},
		status: "active",
	} as unknown as Stripe.SubscriptionSchedule;
	const subscriptionSchedulesCreate = vi.fn(async () => subscriptionSchedule);
	const subscriptionSchedulesRelease = vi.fn(
		async (
			_id: string,
			_params: Stripe.SubscriptionScheduleReleaseParams,
			_options?: Stripe.RequestOptions,
		) => subscriptionSchedule,
	);
	const subscriptionSchedulesRetrieve = vi.fn(async () => subscriptionSchedule);
	const subscriptionSchedulesUpdate = vi.fn(
		async (
			_id: string,
			_params: Stripe.SubscriptionScheduleUpdateParams,
			_options?: Stripe.RequestOptions,
		) => subscriptionSchedule,
	);
	const stripe = {
		billingPortal: {
			configurations: {
				create: portalConfigurationsCreate,
				list: portalConfigurationsList,
				update: portalConfigurationsUpdate,
			},
			sessions: { create: portalSessionsCreate },
		},
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
		invoices: {
			createPreview: invoicesCreatePreview,
		},
		invoicePayments: {
			list: invoicePaymentsList,
		},
		prices: {
			list: pricesList,
		},
		refunds: {
			create: refundsCreate,
		},
		subscriptions: {
			list: subscriptionsList,
			retrieve: subscriptionsRetrieve,
			update: subscriptionsUpdate,
		},
		subscriptionSchedules: {
			create: subscriptionSchedulesCreate,
			release: subscriptionSchedulesRelease,
			retrieve: subscriptionSchedulesRetrieve,
			update: subscriptionSchedulesUpdate,
		},
	} as unknown as Stripe;
	const provider = new StripeProvider();
	(provider as unknown as StripeClientSlot).client = stripe;

	return {
		chargesRetrieve,
		customersCreate,
		invoicesCreatePreview,
		invoicePaymentsAutoPagingToArray,
		invoicePaymentsList,
		portalConfigurationsCreate,
		portalConfigurationsAutoPagingToArray,
		portalConfigurationsList,
		portalConfigurationsUpdate,
		portalSessionsCreate,
		pricesList,
		provider,
		refundsCreate,
		sessionsCreate,
		sessionsExpire,
		sessionsRetrieve,
		subscriptionsRetrieve,
		subscriptionsList,
		subscriptionsUpdate,
		subscriptionPages,
		subscription,
		subscriptionSchedule,
		subscriptionSchedulesCreate,
		subscriptionSchedulesRelease,
		subscriptionSchedulesRetrieve,
		subscriptionSchedulesUpdate,
	};
}

describe("StripeProvider", () => {
	it("finds older active subscriptions beyond a full page of canceled checkout history", async () => {
		const { provider, subscription, subscriptionPages, subscriptionsList } =
			setup();
		const canceled = Array.from({ length: 100 }, (_, index) => ({
			...subscription,
			id: `sub_canceled_${index}`,
			status: "canceled" as const,
		}));
		subscriptionPages.push(canceled, [subscription]);

		const result = await provider.listSubscriptionsForCustomer("cus_1");

		expect(result).toHaveLength(101);
		expect(result.find((item) => item.status === "active")).toBe(subscription);
		expect(subscriptionsList).toHaveBeenCalledWith({
			customer: "cus_1",
			expand: ["data.default_payment_method"],
			limit: 100,
			status: "all",
		});
	});

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

	it("adds an affiliate code to customer metadata when attribution exists", async () => {
		const { customersCreate, provider } = setup();

		await provider.ensureCustomer("user_1", "user@example.com", "partner_2026");

		expect(customersCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: {
					affiliateCode: "partner_2026",
					userId: "user_1",
				},
			}),
			{ idempotencyKey: "customer:user_1" },
		);
	});

	it("persists subscription attempt metadata and exact checkout idempotency", async () => {
		const { pricesList, provider, sessionsCreate } = setup();

		await expect(
			provider.createSubscriptionCheckout({
				attemptId: "11111111-1111-4111-8111-111111111111",
				customerId: "cus_1",
				email: "user@example.com",
				interval: "month",
				plan: "pro",
				tierCredits: 250,
				userId: "user_1",
			}),
		).resolves.toEqual({
			id: "cs_1",
			url: "https://checkout.stripe.test/cs_1",
		});

		expect(pricesList).toHaveBeenCalledWith({
			active: true,
			limit: 1,
			lookup_keys: ["pro_250_month"],
		});
		expect(sessionsCreate.mock.calls[0]).toHaveLength(2);
		expect(sessionsCreate.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				cancel_url: "http://web.test/billing/cancel",
				customer: "cus_1",
				metadata: expect.objectContaining({
					attemptId: "11111111-1111-4111-8111-111111111111",
					purpose: "subscription",
					userId: "user_1",
				}),
				mode: "subscription",
				success_url: "http://web.test/billing/success?purpose=subscription",
			}),
		);
		expect(sessionsCreate.mock.calls[0]?.[1]).toEqual({
			idempotencyKey:
				"sub-checkout:user_1:11111111-1111-4111-8111-111111111111",
		});
	});

	it("wraps only ambiguous Stripe checkout writes for durable recovery", async () => {
		const { provider, sessionsCreate } = setup();
		sessionsCreate.mockRejectedValueOnce(
			new Stripe.errors.StripeConnectionError({
				message: "connection reset",
				type: "api_error",
			}),
		);

		await expect(
			provider.createSubscriptionCheckout({
				attemptId: "11111111-1111-4111-8111-111111111111",
				customerId: "cus_1",
				email: "user@example.com",
				interval: "month",
				plan: "pro",
				tierCredits: 250,
				userId: "user_1",
			}),
		).rejects.toBeInstanceOf(AmbiguousPaymentProviderWriteError);

		sessionsCreate.mockRejectedValueOnce(
			new Stripe.errors.StripeInvalidRequestError({
				message: "invalid price",
				type: "invalid_request_error",
			}),
		);
		await expect(
			provider.createSubscriptionCheckout({
				attemptId: "22222222-2222-4222-8222-222222222222",
				customerId: "cus_1",
				email: "user@example.com",
				interval: "month",
				plan: "pro",
				tierCredits: 250,
				userId: "user_1",
			}),
		).rejects.toBeInstanceOf(Stripe.errors.StripeInvalidRequestError);
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

		await expect(provider.expireCheckoutSession("cs_1")).resolves.toBe(status);
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

		await expect(provider.expireCheckoutSession("cs_1")).resolves.toBe(
			"complete",
		);
		expect(sessionsRetrieve).toHaveBeenCalledTimes(2);
		expect(sessionsExpire).toHaveBeenCalledOnce();
	});

	it("sets explicit top-up purpose metadata", async () => {
		const { pricesList, provider, sessionsCreate } = setup();

		await expect(
			provider.createTopupCheckout({
				attemptId: "22222222-2222-4222-8222-222222222222",
				credits: 700,
				customerId: "cus_1",
				packId: "topup_700",
				userId: "user_1",
			}),
		).resolves.toEqual({
			id: "cs_1",
			url: "https://checkout.stripe.test/cs_1",
		});

		expect(pricesList).toHaveBeenCalledWith({
			active: true,
			limit: 1,
			lookup_keys: ["topup_700"],
		});
		expect(sessionsCreate.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({
				cancel_url: "http://web.test/billing/cancel",
				metadata: {
					attemptId: "22222222-2222-4222-8222-222222222222",
					credits: "700",
					packId: "topup_700",
					purpose: "topup",
					userId: "user_1",
				},
				mode: "payment",
				payment_intent_data: {
					metadata: {
						attemptId: "22222222-2222-4222-8222-222222222222",
						credits: "700",
						packId: "topup_700",
						purpose: "topup",
						userId: "user_1",
					},
				},
				success_url: "http://web.test/billing/success?purpose=topup",
			}),
		);
		expect(sessionsCreate.mock.calls[0]?.[1]).toEqual({
			idempotencyKey:
				"topup-checkout:user_1:22222222-2222-4222-8222-222222222222",
		});
	});

	it("uses the same fixed proration timestamp for preview and metadata-free update", async () => {
		const { invoicesCreatePreview, provider, subscriptionsUpdate } = setup();
		const prorationDate = new Date("2026-08-01T12:34:56.000Z");
		const input = {
			billingCycleAnchorNow: true,
			newPriceLookupKey: "pro_500_year",
			prorationDate,
			providerSubscriptionId: "sub_1",
		};

		await expect(provider.previewSubscriptionChange(input)).resolves.toEqual({
			amountDueMinor: 2_500,
			currency: "usd",
		});
		await expect(
			provider.changeSubscription({
				...input,
				idempotencyKey: "sub-change:user_1:intent_1",
			}),
		).resolves.toEqual({ outcome: "applied" });

		const prorationDateSeconds = Math.floor(prorationDate.getTime() / 1000);
		expect(invoicesCreatePreview).toHaveBeenCalledWith({
			subscription: "sub_1",
			subscription_details: {
				billing_cycle_anchor: "now",
				items: [{ id: "si_1", price: "price_1" }],
				proration_behavior: "always_invoice",
				proration_date: prorationDateSeconds,
			},
		});
		const updateParams = subscriptionsUpdate.mock.calls[0]?.[1];
		expect(updateParams).toEqual({
			billing_cycle_anchor: "now",
			expand: ["latest_invoice"],
			items: [{ id: "si_1", price: "price_1" }],
			payment_behavior: "pending_if_incomplete",
			proration_behavior: "always_invoice",
			proration_date: prorationDateSeconds,
		});
		expect(updateParams).not.toHaveProperty("metadata");
		expect(subscriptionsUpdate.mock.calls[0]?.[2]).toEqual({
			idempotencyKey: "sub-change:user_1:intent_1",
		});
	});

	it("recovers an accepted pending update without issuing a second provider write", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		const pendingExpiresAt = 1_780_003_600;
		subscription.latest_invoice = {
			hosted_invoice_url: "https://invoice.stripe.test/in_pending",
		} as Stripe.Invoice;
		subscription.pending_update = {
			billing_cycle_anchor: null,
			expires_at: pendingExpiresAt,
			subscription_items: [
				{ price: { id: "price_1" } } as Stripe.SubscriptionItem,
			],
			trial_end: null,
			trial_from_plan: false,
		};

		await expect(
			provider.changeSubscription({
				billingCycleAnchorNow: false,
				idempotencyKey: "sub-change:user_1:intent_pending",
				newPriceLookupKey: "pro_500_month",
				prorationDate: new Date("2026-08-01T12:34:56.000Z"),
				providerSubscriptionId: "sub_1",
			}),
		).resolves.toEqual({
			hostedInvoiceUrl: "https://invoice.stripe.test/in_pending",
			outcome: "payment_required",
			pendingExpiresAt: new Date(pendingExpiresAt * 1000),
		});
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("uses the live target price as the durable replay signal after Stripe idempotency expires", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		const [item] = subscription.items.data;

		if (!item) {
			throw new Error("Missing test subscription item");
		}

		item.price = { id: "price_1" } as Stripe.Price;

		await expect(
			provider.changeSubscription({
				billingCycleAnchorNow: false,
				idempotencyKey: "sub-change:user_1:intent_replay",
				newPriceLookupKey: "pro_500_month",
				prorationDate: new Date("2026-08-01T12:34:56.000Z"),
				providerSubscriptionId: "sub_1",
			}),
		).resolves.toEqual({ outcome: "applied" });
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("switches a migration price through the shared client without proration", async () => {
		const { pricesList, provider, subscriptionsUpdate } = setup();

		await provider.switchSubscriptionPriceWithoutProration({
			currentPriceLookupKey: "pro_250_month",
			idempotencyKey: "billing-migrate-v6:month:sub_1:pro_175_month",
			newPriceLookupKey: "pro_175_month",
			providerSubscriptionId: "sub_1",
		});

		expect(pricesList).toHaveBeenCalledWith({
			active: true,
			limit: 1,
			lookup_keys: ["pro_175_month"],
		});
		expect(subscriptionsUpdate).toHaveBeenCalledWith(
			"sub_1",
			{
				items: [{ id: "si_1", price: "price_1" }],
				proration_behavior: "none",
			},
			{
				idempotencyKey: "billing-migrate-v6:month:sub_1:pro_175_month",
			},
		);
	});

	it("treats an already-switched migration price as an idempotent replay", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		const [item] = subscription.items.data;

		if (!item) {
			throw new Error("Missing test subscription item");
		}

		item.price = {
			id: "price_1",
			lookup_key: "pro_175_month",
		} as Stripe.Price;

		await provider.switchSubscriptionPriceWithoutProration({
			currentPriceLookupKey: "pro_250_month",
			idempotencyKey: "billing-migrate-v6:month:sub_1:pro_175_month",
			newPriceLookupKey: "pro_175_month",
			providerSubscriptionId: "sub_1",
		});

		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("refuses to overwrite an unexpected remote migration price", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		const [item] = subscription.items.data;

		if (!item) {
			throw new Error("Missing test subscription item");
		}

		item.price = {
			id: "price_unexpected",
			lookup_key: "pro_500_month",
		} as Stripe.Price;

		await expect(
			provider.switchSubscriptionPriceWithoutProration({
				currentPriceLookupKey: "pro_250_month",
				idempotencyKey: "billing-migrate-v6:month:sub_1:pro_175_month",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("has price pro_500_month, expected pro_250_month");
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("refuses a migration when the Stripe subscription has multiple items", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		const [item] = subscription.items.data;

		if (!item) {
			throw new Error("Missing test subscription item");
		}

		subscription.items.data.push({
			...item,
			id: "si_2",
		} as Stripe.SubscriptionItem);

		await expect(
			provider.switchSubscriptionPriceWithoutProration({
				currentPriceLookupKey: "pro_250_month",
				idempotencyKey: "billing-migrate-v6:month:sub_1:pro_175_month",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("must have exactly one subscription item");
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("refuses a migration price switch while Stripe has a pending update", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		subscription.pending_update = {} as Stripe.Subscription.PendingUpdate;

		await expect(
			provider.switchSubscriptionPriceWithoutProration({
				currentPriceLookupKey: "pro_250_month",
				idempotencyKey: "billing-migrate-v6:month:sub_1:pro_175_month",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("has a pending update");
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("creates an idempotent period-end downgrade schedule without changing the live item", async () => {
		const {
			provider,
			subscriptionSchedulesCreate,
			subscriptionSchedulesUpdate,
			subscriptionsUpdate,
		} = setup();

		await expect(
			provider.scheduleSubscriptionDowngrade({
				allowSameIntentRecovery: true,
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: null,
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_250_month",
				providerSubscriptionId: "sub_1",
			}),
		).resolves.toBe("sub_sched_1");

		expect(subscriptionsUpdate).toHaveBeenCalledOnce();
		expect(subscriptionsUpdate).toHaveBeenCalledWith(
			"sub_1",
			{
				metadata: {
					wanditScheduleIntent: "sub-change:user_1:intent_1",
					wanditScheduleOwner: "period_end_downgrade",
					wanditScheduleTarget: "pro_250_month",
				},
			},
			{ idempotencyKey: "sub-change:user_1:intent_1:mark-owner" },
		);
		expect(subscriptionSchedulesCreate).toHaveBeenCalledWith(
			{ from_subscription: "sub_1" },
			{ idempotencyKey: "sub-change:user_1:intent_1:create-schedule" },
		);
		expect(subscriptionSchedulesUpdate).toHaveBeenCalledWith(
			"sub_sched_1",
			expect.objectContaining({
				end_behavior: "release",
				phases: [
					{
						end_date: 1_780_000_000,
						items: [{ price: "price_old", quantity: 1 }],
						proration_behavior: "none",
						start_date: 1_777_321_600,
					},
					{
						duration: { interval: "month", interval_count: 1 },
						items: [{ price: "price_1", quantity: 1 }],
						proration_behavior: "none",
						start_date: 1_780_000_000,
					},
				],
				proration_behavior: "none",
			}),
			{
				idempotencyKey: "sub-change:user_1:intent_1:configure-schedule",
			},
		);
	});

	it("refuses to schedule over an unexpected remote price", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedulesCreate,
			subscriptionSchedulesUpdate,
			subscriptionsUpdate,
		} = setup();
		const [item] = subscription.items.data;

		if (!item) {
			throw new Error("Missing test subscription item");
		}

		item.price = {
			id: "price_unexpected",
			lookup_key: "pro_500_month",
		} as Stripe.Price;

		await expect(
			provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: null,
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("has price pro_500_month, expected pro_250_month");
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
		expect(subscriptionSchedulesCreate).not.toHaveBeenCalled();
		expect(subscriptionSchedulesUpdate).not.toHaveBeenCalled();
	});

	it.each([
		"month",
		"year",
	] as const)("keeps paid Pro benefits until renewal when scheduling Starter billed every %s", async (interval) => {
		const {
			pricesList,
			provider,
			subscriptionSchedulesCreate,
			subscriptionSchedulesUpdate,
			subscriptionsUpdate,
		} = setup();
		pricesList.mockResolvedValueOnce({
			data: [{ id: "price_starter", lookup_key: `starter_60_${interval}` }],
		} as Stripe.ApiList<Stripe.Price>);

		await provider.scheduleSubscriptionDowngrade({
			currentPriceLookupKey: "pro_250_month",
			expectedScheduleTarget: null,
			idempotencyKey: `sub-change:user_1:starter_${interval}`,
			newPriceLookupKey: `starter_60_${interval}`,
			providerSubscriptionId: "sub_1",
		});

		// One existing subscription changes price at its paid-through date;
		// there is no immediate Starter invoice or refund of spent Pro credits.
		expect(subscriptionSchedulesCreate).toHaveBeenCalledWith(
			{ from_subscription: "sub_1" },
			expect.anything(),
		);
		expect(subscriptionSchedulesUpdate).toHaveBeenCalledWith(
			"sub_sched_1",
			expect.objectContaining({
				end_behavior: "release",
				phases: [
					{
						end_date: 1_780_000_000,
						items: [{ price: "price_old", quantity: 1 }],
						proration_behavior: "none",
						start_date: 1_777_321_600,
					},
					{
						duration: { interval, interval_count: 1 },
						items: [{ price: "price_starter", quantity: 1 }],
						proration_behavior: "none",
						start_date: 1_780_000_000,
					},
				],
				proration_behavior: "none",
			}),
			expect.anything(),
		);
		expect(subscriptionsUpdate).toHaveBeenCalledOnce();
		expect(subscriptionsUpdate.mock.calls[0]?.[1]).not.toHaveProperty("items");
	});

	it("refuses to replace an owned schedule with an unexpected target", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedulesCreate,
			subscriptionSchedulesUpdate,
			subscriptionsUpdate,
		} = setup();
		subscription.schedule = "sub_sched_1";

		await expect(
			provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: "pro_500_month",
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow(
			"Stripe subscription schedule sub_sched_1 targets pro_250_month, expected pro_500_month",
		);
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
		expect(subscriptionSchedulesCreate).not.toHaveBeenCalled();
		expect(subscriptionSchedulesUpdate).not.toHaveBeenCalled();
	});

	it("refuses an attached schedule when local state expects none", async () => {
		const { provider, subscription, subscriptionSchedulesUpdate } = setup();
		subscription.schedule = "sub_sched_1";

		await expect(
			provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: null,
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("has an attached downgrade schedule");
		expect(subscriptionSchedulesUpdate).not.toHaveBeenCalled();
	});

	it("recovers the same scheduling attempt when its local marker was not persisted", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedulesCreate,
			subscriptionSchedulesUpdate,
			subscriptionsUpdate,
		} = setup();
		subscription.schedule = "sub_sched_1";

		await expect(
			provider.scheduleSubscriptionDowngrade({
				allowSameIntentRecovery: true,
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: null,
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_250_month",
				providerSubscriptionId: "sub_1",
			}),
		).resolves.toBe("sub_sched_1");
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
		expect(subscriptionSchedulesCreate).not.toHaveBeenCalled();
		expect(subscriptionSchedulesUpdate).toHaveBeenCalledOnce();
	});

	it("refuses to recreate a schedule when local state expects one to exist", async () => {
		const {
			provider,
			subscriptionSchedulesCreate,
			subscriptionSchedulesUpdate,
			subscriptionsUpdate,
		} = setup();

		await expect(
			provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: "pro_500_month",
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow(
			"has no attached downgrade schedule, expected pro_500_month",
		);
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
		expect(subscriptionSchedulesCreate).not.toHaveBeenCalled();
		expect(subscriptionSchedulesUpdate).not.toHaveBeenCalled();
	});

	it("refuses to schedule for a cancelling or non-entitled subscription", async () => {
		const cancelling = setup();
		cancelling.subscription.cancel_at_period_end = true;

		await expect(
			cancelling.provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: null,
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("is set to cancel at period end");
		expect(cancelling.subscriptionSchedulesCreate).not.toHaveBeenCalled();

		const pastDue = setup();
		pastDue.subscription.status = "past_due";

		await expect(
			pastDue.provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: null,
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("has non-entitled status past_due");
		expect(pastDue.subscriptionSchedulesCreate).not.toHaveBeenCalled();

		const pendingUpdate = setup();
		pendingUpdate.subscription.pending_update =
			{} as Stripe.Subscription.PendingUpdate;

		await expect(
			pendingUpdate.provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: null,
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("has a pending update");
		expect(pendingUpdate.subscriptionSchedulesCreate).not.toHaveBeenCalled();
	});

	it("refuses to schedule when the Stripe subscription has multiple items", async () => {
		const { provider, subscription, subscriptionSchedulesCreate } = setup();
		const [item] = subscription.items.data;

		if (!item) {
			throw new Error("Missing test subscription item");
		}

		subscription.items.data.push({
			...item,
			id: "si_2",
		} as Stripe.SubscriptionItem);

		await expect(
			provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: null,
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_175_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("must have exactly one subscription item");
		expect(subscriptionSchedulesCreate).not.toHaveBeenCalled();
	});

	it("reconfigures the same owned schedule on replay without creating a duplicate", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedulesCreate,
			subscriptionSchedulesUpdate,
			subscriptionsUpdate,
		} = setup();
		subscription.schedule = "sub_sched_1";

		await expect(
			provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: "pro_250_month",
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_250_month",
				providerSubscriptionId: "sub_1",
			}),
		).resolves.toBe("sub_sched_1");

		expect(subscriptionSchedulesCreate).not.toHaveBeenCalled();
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
		expect(subscriptionSchedulesUpdate).toHaveBeenCalledOnce();
		expect(subscriptionSchedulesUpdate.mock.calls[0]?.[2]).toEqual({
			idempotencyKey: "sub-change:user_1:intent_1:configure-schedule",
		});
	});

	it("fails closed instead of replacing an unmanaged subscription schedule", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedule,
			subscriptionSchedulesUpdate,
		} = setup();
		subscription.schedule = "sub_sched_foreign";
		subscriptionSchedule.metadata = {};

		await expect(
			provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: "pro_250_month",
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_250_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toThrow("controlled by an unmanaged schedule");
		expect(subscriptionSchedulesUpdate).not.toHaveBeenCalled();
	});

	it("keeps a partially-mutated schedule operation retryable even when a later Stripe error is definite", async () => {
		const { provider, subscription, subscriptionSchedulesUpdate } = setup();
		subscription.schedule = "sub_sched_1";
		subscriptionSchedulesUpdate.mockRejectedValueOnce(
			new Stripe.errors.StripeInvalidRequestError({
				message: "invalid phase",
				type: "invalid_request_error",
			}),
		);

		await expect(
			provider.scheduleSubscriptionDowngrade({
				currentPriceLookupKey: "pro_250_month",
				expectedScheduleTarget: "pro_250_month",
				idempotencyKey: "sub-change:user_1:intent_1",
				newPriceLookupKey: "pro_250_month",
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toBeInstanceOf(AmbiguousPaymentProviderWriteError);
	});

	it("releases the owned downgrade schedule before an immediate upgrade", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedulesRelease,
			subscriptionsUpdate,
		} = setup();
		subscription.schedule = "sub_sched_1";

		await provider.changeSubscription({
			billingCycleAnchorNow: false,
			idempotencyKey: "sub-change:user_1:intent_2",
			newPriceLookupKey: "pro_500_month",
			prorationDate: new Date("2026-08-01T12:34:56.000Z"),
			providerSubscriptionId: "sub_1",
		});

		expect(subscriptionSchedulesRelease).toHaveBeenCalledWith(
			"sub_sched_1",
			{},
			{
				idempotencyKey:
					"sub-change:user_1:intent_2:release-schedule:sub_sched_1",
			},
		);
		expect(subscriptionsUpdate).toHaveBeenCalledTimes(2);
		expect(subscriptionsUpdate.mock.calls[1]?.[1]).toMatchObject({
			items: [{ id: "si_1", price: "price_1" }],
			proration_behavior: "always_invoice",
		});
		expect(
			subscriptionSchedulesRelease.mock.invocationCallOrder[0],
		).toBeLessThan(subscriptionsUpdate.mock.invocationCallOrder[1] ?? 0);
	});

	it("scopes repeated release idempotency to the attached schedule id", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedule,
			subscriptionSchedulesRelease,
		} = setup();
		subscription.schedule = "sub_sched_1";

		await provider.cancelScheduledSubscriptionDowngrade(
			"sub_1",
			"sub-change:user_1:intent_2:release-schedule",
		);
		subscription.schedule = "sub_sched_2";
		subscriptionSchedule.id = "sub_sched_2";
		await provider.cancelScheduledSubscriptionDowngrade(
			"sub_1",
			"sub-change:user_1:intent_2:release-schedule",
		);

		expect(
			subscriptionSchedulesRelease.mock.calls.map(([scheduleId, , options]) => [
				scheduleId,
				options?.idempotencyKey,
			]),
		).toEqual([
			[
				"sub_sched_1",
				"sub-change:user_1:intent_2:release-schedule:sub_sched_1",
			],
			[
				"sub_sched_2",
				"sub-change:user_1:intent_2:release-schedule:sub_sched_2",
			],
		]);
	});

	it("releases a pending Starter downgrade before canceling at the paid period end", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedule,
			subscriptionSchedulesRelease,
			subscriptionsUpdate,
		} = setup();
		subscription.schedule = "sub_sched_1";
		subscriptionSchedule.metadata = {
			...subscriptionSchedule.metadata,
			wanditScheduleTarget: "starter_60_year",
		};

		await provider.setCancelAtPeriodEnd("sub_1", true);

		expect(subscriptionSchedulesRelease).toHaveBeenCalledWith(
			"sub_sched_1",
			{},
			{
				idempotencyKey: "sub-cancel:sub_1:release-schedule:sub_sched_1",
			},
		);
		expect(subscriptionsUpdate).toHaveBeenLastCalledWith("sub_1", {
			cancel_at_period_end: true,
		});
		expect(
			subscriptionSchedulesRelease.mock.invocationCallOrder[0],
		).toBeLessThan(subscriptionsUpdate.mock.invocationCallOrder.at(-1) ?? 0);
	});

	it("preserves the downgrade schedule when resuming an already renewing subscription", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedulesRelease,
			subscriptionsUpdate,
		} = setup();
		subscription.schedule = "sub_sched_1";

		await provider.setCancelAtPeriodEnd("sub_1", false);

		expect(subscriptionSchedulesRelease).not.toHaveBeenCalled();
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("resumes a subscription that is scheduled to cancel", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		subscription.cancel_at_period_end = true;

		await provider.setCancelAtPeriodEnd("sub_1", false);

		expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_1", {
			cancel_at_period_end: false,
		});
	});

	it("does not release an unmanaged schedule to cancel a subscription", async () => {
		const {
			provider,
			subscription,
			subscriptionSchedule,
			subscriptionSchedulesRelease,
			subscriptionsUpdate,
		} = setup();
		subscription.schedule = "sub_sched_1";
		subscriptionSchedule.metadata = {};

		await expect(provider.setCancelAtPeriodEnd("sub_1", true)).rejects.toThrow(
			"controlled by an unmanaged schedule",
		);

		expect(subscriptionSchedulesRelease).not.toHaveBeenCalled();
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("keeps cancellation retryable if releasing the downgrade succeeds before cancellation fails", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		subscription.schedule = "sub_sched_1";
		subscriptionsUpdate
			.mockResolvedValueOnce(subscription)
			.mockRejectedValueOnce(
				new Stripe.errors.StripeInvalidRequestError({
					message: "cancellation update rejected",
					type: "invalid_request_error",
				}),
			);

		await expect(
			provider.setCancelAtPeriodEnd("sub_1", true),
		).rejects.toBeInstanceOf(AmbiguousPaymentProviderWriteError);
	});

	it("keeps an upgrade retryable when schedule release succeeded before a definite update error", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		subscription.schedule = "sub_sched_1";
		subscriptionsUpdate
			.mockResolvedValueOnce(subscription)
			.mockRejectedValueOnce(
				new Stripe.errors.StripeInvalidRequestError({
					message: "invalid subscription update",
					type: "invalid_request_error",
				}),
			);

		await expect(
			provider.changeSubscription({
				billingCycleAnchorNow: false,
				idempotencyKey: "sub-change:user_1:intent_2",
				newPriceLookupKey: "pro_500_month",
				prorationDate: new Date("2026-08-01T12:34:56.000Z"),
				providerSubscriptionId: "sub_1",
			}),
		).rejects.toBeInstanceOf(AmbiguousPaymentProviderWriteError);
	});

	it("keeps stale schedule-owner cleanup retryable after the remote schedule is already gone", async () => {
		const { provider, subscription, subscriptionsUpdate } = setup();
		subscription.metadata = {
			wanditScheduleIntent: "sub-change:user_1:intent_1",
			wanditScheduleOwner: "period_end_downgrade",
			wanditScheduleTarget: "pro_250_month",
		};
		subscriptionsUpdate.mockRejectedValueOnce(
			new Stripe.errors.StripeInvalidRequestError({
				message: "metadata cleanup rejected",
				type: "invalid_request_error",
			}),
		);

		await expect(
			provider.cancelScheduledSubscriptionDowngrade(
				"sub_1",
				"sub-change:user_1:intent_2:release-schedule",
			),
		).rejects.toBeInstanceOf(AmbiguousPaymentProviderWriteError);
	});

	it("creates and caches a restricted portal configuration without cancellation", async () => {
		const {
			portalConfigurationsCreate,
			portalConfigurationsList,
			portalSessionsCreate,
			provider,
		} = setup();

		await expect(provider.createPortalSession("cus_1")).resolves.toBe(
			"https://billing.stripe.test/session",
		);
		await provider.createPortalSession("cus_1");

		expect(portalConfigurationsCreate).toHaveBeenCalledOnce();
		expect(portalConfigurationsList).toHaveBeenCalledOnce();
		expect(portalConfigurationsList).toHaveBeenCalledWith({
			active: true,
			limit: 100,
		});
		expect(portalConfigurationsCreate).toHaveBeenCalledWith(
			{
				features: {
					customer_update: { allowed_updates: [], enabled: false },
					invoice_history: { enabled: true },
					payment_method_update: { enabled: true },
					subscription_cancel: { enabled: false },
					subscription_update: { enabled: false },
				},
				name: "Wandit restricted billing portal v2",
			},
			{ idempotencyKey: "billing-portal:restricted:v2" },
		);
		expect(portalSessionsCreate).toHaveBeenCalledTimes(2);
		expect(portalSessionsCreate).toHaveBeenCalledWith({
			configuration: "bpc_restricted",
			customer: "cus_1",
			return_url: "http://web.test/dashboard",
		});
	});

	it("reuses and re-enforces the named fallback portal configuration across restarts", async () => {
		const {
			portalConfigurationsAutoPagingToArray,
			portalConfigurationsCreate,
			portalConfigurationsUpdate,
			portalSessionsCreate,
			provider,
		} = setup();
		portalConfigurationsAutoPagingToArray.mockResolvedValueOnce([
			{
				id: "bpc_existing",
				name: "Wandit restricted billing portal v2",
			} as Stripe.BillingPortal.Configuration,
		]);

		await provider.createPortalSession("cus_1");

		expect(portalConfigurationsCreate).not.toHaveBeenCalled();
		expect(portalConfigurationsUpdate).toHaveBeenCalledWith(
			"bpc_existing",
			expect.objectContaining({
				features: expect.objectContaining({
					subscription_cancel: { enabled: false },
					subscription_update: { enabled: false },
				}),
			}),
			{
				idempotencyKey: "billing-portal:restricted:v2:enforce:bpc_existing",
			},
		);
		expect(portalSessionsCreate).toHaveBeenCalledWith(
			expect.objectContaining({ configuration: "bpc_existing" }),
		);
	});

	it("re-enforces the persisted portal configuration override without creating duplicates", async () => {
		const mutableEnv = env as unknown as {
			STRIPE_PORTAL_CONFIGURATION_ID?: string;
		};
		const original = mutableEnv.STRIPE_PORTAL_CONFIGURATION_ID;
		mutableEnv.STRIPE_PORTAL_CONFIGURATION_ID = "bpc_persisted";

		try {
			const {
				portalConfigurationsCreate,
				portalConfigurationsList,
				portalConfigurationsUpdate,
				portalSessionsCreate,
				provider,
			} = setup();
			await provider.createPortalSession("cus_1");

			expect(portalConfigurationsCreate).not.toHaveBeenCalled();
			expect(portalConfigurationsList).not.toHaveBeenCalled();
			expect(portalConfigurationsUpdate).toHaveBeenCalledWith(
				"bpc_persisted",
				expect.objectContaining({
					features: expect.objectContaining({
						invoice_history: { enabled: true },
						payment_method_update: { enabled: true },
						subscription_cancel: { enabled: false },
					}),
				}),
				{
					idempotencyKey: "billing-portal:restricted:v2:enforce:bpc_persisted",
				},
			);
			expect(portalSessionsCreate).toHaveBeenCalledWith(
				expect.objectContaining({ configuration: "bpc_persisted" }),
			);
		} finally {
			mutableEnv.STRIPE_PORTAL_CONFIGURATION_ID = original;
		}
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

	it("lists every paid invoice payment with funding charges expanded", async () => {
		const { invoicePaymentsAutoPagingToArray, invoicePaymentsList, provider } =
			setup();

		await expect(provider.listInvoicePayments("in_1")).resolves.toEqual([]);
		expect(invoicePaymentsList).toHaveBeenCalledWith({
			expand: ["data.payment.payment_intent"],
			invoice: "in_1",
			limit: 100,
			status: "paid",
		});
		expect(invoicePaymentsAutoPagingToArray).toHaveBeenCalledWith({
			limit: 10_000,
		});
	});
});
