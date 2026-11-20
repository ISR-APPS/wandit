import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import { userOwner } from "../../../credits/domain/credit-owner";
import type { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import type {
	BillingCheckoutAttemptRow,
	BillingCheckoutAttemptsRepository,
} from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import type {
	BillingCustomerRow,
	BillingCustomersRepository,
} from "../../infrastructure/persistence/billing-customers.repository";
import type { StripeProvider } from "../../infrastructure/stripe/stripe.provider";
import type { PaymentRefundsService } from "./payment-refunds.service";
import { SubscriptionCreditsService } from "./subscription-credits.service";

type AttemptOverrides = Partial<BillingCheckoutAttemptRow>;

function checkoutAttempt(
	overrides: AttemptOverrides = {},
): BillingCheckoutAttemptRow {
	return {
		amountUsdCents: 2_500,
		createdAt: new Date(0),
		// UNIT: centi-credits. 250 credits for 25 USD.
		credits: 25_000,
		id: "11111111-1111-4111-8111-111111111111",
		organizationId: null,
		packId: null,
		priceLookupKey: null,
		providerSessionId: "cs_topup",
		purpose: "topup",
		status: "session_attached",
		updatedAt: new Date(0),
		userId: "user_1",
		...overrides,
	};
}

function checkoutSession(
	overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
	// SAFETY: grantTopup reads only the fields set here; the rest of the session type is unused.
	return {
		amount_subtotal: 2_500,
		amount_total: 2_500,
		currency: "usd",
		customer: "cus_1",
		id: "cs_topup",
		metadata: {
			attemptId: "11111111-1111-4111-8111-111111111111",
			purpose: "topup",
			userId: "user_1",
		},
		mode: "payment",
		payment_intent: "pi_topup",
		payment_status: "paid",
		total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
		...overrides,
	} as Stripe.Checkout.Session;
}

/** A pricing v7 pack attempt: no amount columns, the pack sets the price and the credits. */
const legacyAttempt = (overrides: AttemptOverrides = {}) =>
	checkoutAttempt({
		amountUsdCents: null,
		credits: null,
		packId: "topup_175",
		...overrides,
	});

/** The Stripe session of a pricing v7 pack: the pack and its credits are in the metadata. */
const legacySession = (overrides: Partial<Stripe.Checkout.Session> = {}) =>
	checkoutSession({
		metadata: {
			...checkoutSession().metadata,
			credits: "175",
			packId: "topup_175",
		},
		...overrides,
	});

function billingCustomer(
	overrides: Partial<BillingCustomerRow> = {},
): BillingCustomerRow {
	return {
		createdAt: new Date(0),
		id: "22222222-2222-4222-8222-222222222222",
		openCheckoutSessionId: null,
		provider: "stripe",
		providerCustomerId: "cus_1",
		updatedAt: new Date(0),
		userId: "user_1",
		...overrides,
	};
}

function setup(
	input: {
		attempt?: BillingCheckoutAttemptRow | null;
		completionSucceeds?: boolean;
		customer?: BillingCustomerRow | null;
	} = {},
) {
	const order: string[] = [];
	let attempt = input.attempt === undefined ? checkoutAttempt() : input.attempt;
	const attempts = {
		attachSession: vi.fn(async (id: string, sessionId: string) => {
			if (
				!attempt ||
				attempt.id !== id ||
				attempt.status !== "created" ||
				attempt.providerSessionId !== null
			) {
				return null;
			}

			attempt = {
				...attempt,
				providerSessionId: sessionId,
				status: "session_attached",
			};

			return attempt;
		}),
		findById: vi.fn(async (id: string) =>
			attempt?.id === id ? attempt : null,
		),
		findByProviderSessionId: vi.fn(async (sessionId: string) =>
			attempt?.providerSessionId === sessionId ? attempt : null,
		),
		markCompletedBySession: vi.fn(async () => {
			order.push("complete-attempt");

			if (!attempt || input.completionSucceeds === false) {
				return null;
			}

			attempt = { ...attempt, status: "completed" };

			return attempt;
		}),
		withUserLock: vi.fn(
			async (_userId: string, operation: (tx: object) => unknown) =>
				operation({ kind: "attempt-transaction" }),
		),
	};
	const customers = {
		findByUserId: vi.fn(async () =>
			input.customer === undefined ? billingCustomer() : input.customer,
		),
	};
	const credits = {
		topup: vi.fn(async () => {
			order.push("grant-credits");

			return {};
		}),
	};
	const creditTransaction = { kind: "credit-transaction" };
	const subscriptionCreditsRepository = {
		withOwnerLock: vi.fn(
			async (_owner: unknown, operation: (tx: object) => unknown) =>
				operation(creditTransaction),
		),
	};
	const lifecycleEvents = {
		enqueue: vi.fn(async () => {
			order.push("enqueue-lifecycle");

			return null;
		}),
	};
	const stripe = {
		retrievePaymentIntent: vi.fn(async () => ({
			id: "pi_topup",
			latest_charge: "ch_topup",
			object: "payment_intent",
		})),
	};
	const refunds = {
		reconcileChargeAfterGrant: vi.fn(async () => {
			order.push("reconcile-charge");
		}),
	};
	const reconciliationOutbox = {
		enqueue: vi.fn(async () => {
			order.push("enqueue-outbox");

			return null;
		}),
		markDoneForCharge: vi.fn(async () => {
			order.push("outbox-done");

			return 1;
		}),
	};
	const receipts = {
		insertIfAbsent: vi.fn(async () => {
			order.push("write-receipt");

			return null;
		}),
	};
	const service = new SubscriptionCreditsService(
		customers as unknown as BillingCustomersRepository,
		{} as never,
		credits as unknown as CreditsService,
		stripe as unknown as StripeProvider,
		refunds as unknown as PaymentRefundsService,
		subscriptionCreditsRepository as never,
		{} as never,
		attempts as unknown as BillingCheckoutAttemptsRepository,
		{ findByProviderCustomerId: async () => null } as never,
		reconciliationOutbox as never,
		receipts as never,
		lifecycleEvents as unknown as LifecycleEventsService,
	);

	return {
		attempts,
		creditTransaction,
		credits,
		customers,
		lifecycleEvents,
		order,
		receipts,
		reconciliationOutbox,
		refunds,
		service,
		stripe,
		subscriptionCreditsRepository,
	};
}

describe("SubscriptionCreditsService top-up fulfillment", () => {
	it("validates the persisted attempt and catalog facts before completing after the grant", async () => {
		const {
			attempts,
			creditTransaction,
			credits,
			lifecycleEvents,
			order,
			refunds,
			service,
		} = setup();

		await service.grantTopup(checkoutSession());

		// The attempt column is already in centi-credits: the grant passes it with no factor.
		expect(credits.topup).toHaveBeenCalledWith(
			userOwner("user_1"),
			25_000,
			{
				idempotencyKey: "topup:cs_topup",
				meta: {
					amountUsdCents: 2_500,
					chargeId: "ch_topup",
					paymentIntentId: "pi_topup",
					reason: "topup_purchase",
					sessionId: "cs_topup",
				},
			},
			creditTransaction,
		);
		expect(lifecycleEvents.enqueue).toHaveBeenCalledWith(
			{
				event: "payment_completed",
				idempotencyKey: "payment_completed:user_1",
				payload: { interval: "topup" },
				userId: "user_1",
			},
			creditTransaction,
		);
		expect(attempts.withUserLock).toHaveBeenCalledWith(
			"user_1",
			expect.any(Function),
		);
		expect(attempts.markCompletedBySession).toHaveBeenCalledWith(
			"cs_topup",
			expect.anything(),
		);
		expect(refunds.reconcileChargeAfterGrant).toHaveBeenCalledWith("ch_topup");
		expect(order).toEqual([
			"grant-credits",
			"write-receipt",
			"enqueue-lifecycle",
			"enqueue-outbox",
			"complete-attempt",
			"reconcile-charge",
			"outbox-done",
		]);
	});

	it("writes the receipt before propagating a lifecycle failure from the transaction", async () => {
		const { creditTransaction, lifecycleEvents, order, receipts, service } =
			setup();
		lifecycleEvents.enqueue.mockImplementationOnce(async () => {
			order.push("enqueue-lifecycle");
			throw new Error("outbox unavailable");
		});

		await expect(service.grantTopup(checkoutSession())).rejects.toThrow(
			"outbox unavailable",
		);
		expect(receipts.insertIfAbsent).toHaveBeenCalledWith(
			expect.objectContaining({ providerReference: "cs_topup" }),
			creditTransaction,
		);
		expect(order).toEqual([
			"grant-credits",
			"write-receipt",
			"enqueue-lifecycle",
		]);
	});

	it("writes a top-up cash receipt and a reconciliation outbox row keyed by the session", async () => {
		const { creditTransaction, receipts, reconciliationOutbox, service } =
			setup();

		await service.grantTopup(checkoutSession());

		expect(receipts.insertIfAbsent).toHaveBeenCalledWith(
			expect.objectContaining({
				amountCents: 2_500,
				amountUsdCents: 2_500,
				chargeId: "ch_topup",
				credits: 25_000,
				currency: "usd",
				organizationId: null,
				packId: null,
				paymentIntentId: "pi_topup",
				provider: "stripe",
				providerReference: "cs_topup",
				userId: "user_1",
			}),
			creditTransaction,
		);
		expect(reconciliationOutbox.enqueue).toHaveBeenCalledWith({
			chargeId: "ch_topup",
			triggerRef: "topup:cs_topup",
		});
		expect(reconciliationOutbox.markDoneForCharge).toHaveBeenCalledWith(
			"ch_topup",
		);
	});

	it("accepts a completed attempt as an idempotent webhook replay", async () => {
		const { attempts, credits, service } = setup({
			attempt: checkoutAttempt({ status: "completed" }),
		});

		await service.grantTopup(checkoutSession());

		expect(credits.topup).toHaveBeenCalledOnce();
		expect(attempts.markCompletedBySession).not.toHaveBeenCalled();
	});

	it("grants the credits of the attempt row and ignores credits in the session metadata", async () => {
		const { credits, service } = setup({
			attempt: checkoutAttempt({ credits: 12_345 }),
		});

		await service.grantTopup(
			checkoutSession({
				metadata: { ...checkoutSession().metadata, credits: "99999" },
			}),
		);

		expect(credits.topup).toHaveBeenCalledWith(
			userOwner("user_1"),
			12_345,
			expect.anything(),
			expect.anything(),
		);
	});

	it("fulfills a pricing v7 pack session that was open at the deploy", async () => {
		const { creditTransaction, credits, receipts, service } = setup({
			attempt: legacyAttempt({ packId: "topup_250" }),
		});

		await service.grantTopup(
			legacySession({
				metadata: {
					...legacySession().metadata,
					credits: "250",
					packId: "topup_250",
				},
			}),
		);

		expect(credits.topup).toHaveBeenCalledWith(
			userOwner("user_1"),
			25_000,
			expect.objectContaining({
				meta: expect.objectContaining({ packId: "topup_250" }),
			}),
			creditTransaction,
		);
		expect(receipts.insertIfAbsent).toHaveBeenCalledWith(
			expect.objectContaining({
				amountUsdCents: 2_500,
				credits: 25_000,
				packId: "topup_250",
			}),
			creditTransaction,
		);
	});

	it("recovers the create-to-attach crash window from signed session metadata", async () => {
		const { attempts, credits, service } = setup({
			attempt: checkoutAttempt({
				providerSessionId: null,
				status: "created",
			}),
		});

		await service.grantTopup(checkoutSession());

		expect(attempts.attachSession).toHaveBeenCalledWith(
			"11111111-1111-4111-8111-111111111111",
			"cs_topup",
			expect.anything(),
		);
		expect(credits.topup).toHaveBeenCalledOnce();
	});

	it("leaves reconciliation retryable when completion fails after the grant", async () => {
		const { credits, refunds, service } = setup({
			completionSucceeds: false,
		});

		await expect(service.grantTopup(checkoutSession())).rejects.toThrow(
			"could not be marked completed after top-up fulfillment",
		);
		expect(credits.topup).toHaveBeenCalledOnce();
		expect(refunds.reconcileChargeAfterGrant).not.toHaveBeenCalled();
	});

	it("rejects a paid session without a persisted attempt", async () => {
		const { credits, service } = setup({ attempt: null });

		await expect(service.grantTopup(checkoutSession())).rejects.toThrow(
			"has no persisted checkout attempt",
		);
		expect(credits.topup).not.toHaveBeenCalled();
	});

	it.each([
		{
			attempt: checkoutAttempt({ purpose: "subscription" }),
			expected: "has purpose subscription, expected topup",
			name: "attempt purpose",
			session: checkoutSession(),
		},
		{
			attempt: checkoutAttempt({ status: "expired" }),
			expected: "has non-fulfillable status expired",
			name: "attempt status",
			session: checkoutSession(),
		},
		{
			attempt: checkoutAttempt({ priceLookupKey: "pro_175_month" }),
			expected: "unexpectedly has a subscription price",
			name: "attempt shape",
			session: checkoutSession(),
		},
		{
			attempt: checkoutAttempt(),
			expected: "has purpose subscription, expected topup",
			name: "session purpose",
			session: checkoutSession({
				metadata: {
					...checkoutSession().metadata,
					purpose: "subscription",
				},
			}),
		},
		{
			attempt: checkoutAttempt(),
			expected: "attempt metadata does not match",
			name: "attempt metadata",
			session: checkoutSession({
				metadata: {
					...checkoutSession().metadata,
					attemptId: "33333333-3333-4333-8333-333333333333",
				},
			}),
		},
		{
			attempt: checkoutAttempt(),
			expected: "user metadata does not match",
			name: "user metadata",
			session: checkoutSession({
				metadata: { ...checkoutSession().metadata, userId: "user_2" },
			}),
		},
		{
			attempt: checkoutAttempt(),
			expected: "amount_subtotal does not match checkout attempt",
			name: "subtotal",
			session: checkoutSession({ amount_subtotal: 2_499 }),
		},
		{
			attempt: checkoutAttempt(),
			expected: "has a discount",
			name: "discount",
			// A 50% code keeps the subtotal at the attempt amount but halves the money paid.
			session: checkoutSession({
				amount_total: 1_250,
				total_details: {
					amount_discount: 1_250,
					amount_shipping: 0,
					amount_tax: 0,
				},
			}),
		},
		{
			attempt: checkoutAttempt(),
			expected: "currency is not usd",
			name: "currency",
			session: checkoutSession({ currency: "eur" }),
		},
		{
			attempt: legacyAttempt({ packId: "future_pack" }),
			expected: "has unknown top-up pack future_pack",
			name: "unknown v7 pack",
			session: legacySession({
				metadata: {
					...legacySession().metadata,
					packId: "future_pack",
				},
			}),
		},
		{
			attempt: legacyAttempt(),
			expected: "pack topup_700 does not match checkout attempt",
			name: "v7 attempt pack",
			session: legacySession({
				metadata: {
					...legacySession().metadata,
					packId: "topup_700",
				},
			}),
		},
		{
			attempt: legacyAttempt(),
			expected: "credits 700 do not match top-up pack topup_175",
			name: "v7 credits",
			session: legacySession({
				metadata: { ...legacySession().metadata, credits: "700" },
			}),
		},
		{
			attempt: legacyAttempt(),
			expected: "amount_total does not match top-up pack topup_175",
			name: "v7 amount",
			session: legacySession({ amount_total: 2_499 }),
		},
		{
			attempt: checkoutAttempt(),
			expected: "customer does not match the billing customer",
			name: "customer",
			session: checkoutSession({ customer: "cus_other" }),
		},
		{
			attempt: checkoutAttempt(),
			expected: "must use payment mode",
			name: "checkout mode",
			session: checkoutSession({ mode: "subscription" }),
		},
		{
			attempt: checkoutAttempt(),
			expected: "is not paid",
			name: "payment status",
			session: checkoutSession({ payment_status: "unpaid" }),
		},
	])("rejects a top-up with mismatched $name", async ({
		attempt,
		expected,
		session,
	}) => {
		const { attempts, credits, service } = setup({ attempt });

		await expect(service.grantTopup(session)).rejects.toThrow(expected);
		expect(credits.topup).not.toHaveBeenCalled();
		expect(attempts.markCompletedBySession).not.toHaveBeenCalled();
	});

	it("rejects a customer whose local mapping is missing or belongs to another provider", async () => {
		const missing = setup({ customer: null });
		const foreign = setup({
			customer: billingCustomer({ provider: "cib" }),
		});

		await expect(missing.service.grantTopup(checkoutSession())).rejects.toThrow(
			"customer does not match the billing customer",
		);
		await expect(foreign.service.grantTopup(checkoutSession())).rejects.toThrow(
			"customer does not match the billing customer",
		);
	});
});
