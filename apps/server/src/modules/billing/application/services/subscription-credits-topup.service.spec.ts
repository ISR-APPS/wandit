import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import { userOwner } from "../../../credits/domain/credit-owner";
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
		createdAt: new Date(0),
		id: "11111111-1111-4111-8111-111111111111",
		organizationId: null,
		packId: "topup_250",
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
	return {
		amount_total: 2_500,
		currency: "usd",
		customer: "cus_1",
		id: "cs_topup",
		metadata: {
			attemptId: "11111111-1111-4111-8111-111111111111",
			credits: "250",
			packId: "topup_250",
			purpose: "topup",
			userId: "user_1",
		},
		mode: "payment",
		payment_intent: "pi_topup",
		payment_status: "paid",
		...overrides,
	} as Stripe.Checkout.Session;
}

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
		{} as never,
		{} as never,
		attempts as unknown as BillingCheckoutAttemptsRepository,
		{ findByProviderCustomerId: async () => null } as never,
		reconciliationOutbox as never,
		receipts as never,
	);

	return {
		attempts,
		credits,
		customers,
		order,
		receipts,
		reconciliationOutbox,
		refunds,
		service,
		stripe,
	};
}

describe("SubscriptionCreditsService top-up fulfillment", () => {
	it("validates the persisted attempt and catalog facts before completing after the grant", async () => {
		const { attempts, credits, order, refunds, service } = setup();

		await service.grantTopup(checkoutSession());

		// 250-credit pack -> 25000 centi-credits at the grant boundary.
		expect(credits.topup).toHaveBeenCalledWith(userOwner("user_1"), 25_000, {
			idempotencyKey: "topup:cs_topup",
			meta: {
				chargeId: "ch_topup",
				packId: "topup_250",
				paymentIntentId: "pi_topup",
				reason: "topup_purchase",
				sessionId: "cs_topup",
			},
		});
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
			"enqueue-outbox",
			"complete-attempt",
			"reconcile-charge",
			"outbox-done",
		]);
	});

	it("writes a top-up cash receipt and a reconciliation outbox row keyed by the session", async () => {
		const { receipts, reconciliationOutbox, service } = setup();

		await service.grantTopup(checkoutSession());

		expect(receipts.insertIfAbsent).toHaveBeenCalledWith(
			expect.objectContaining({
				amountCents: 2_500,
				chargeId: "ch_topup",
				currency: "usd",
				organizationId: null,
				packId: "topup_250",
				paymentIntentId: "pi_topup",
				sessionId: "cs_topup",
				userId: "user_1",
			}),
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
			attempt: checkoutAttempt({ priceLookupKey: "pro_250_month" }),
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
			attempt: checkoutAttempt({ packId: "future_pack" }),
			expected: "has unknown top-up pack future_pack",
			name: "unknown catalog pack",
			session: checkoutSession({
				metadata: {
					...checkoutSession().metadata,
					packId: "future_pack",
				},
			}),
		},
		{
			attempt: checkoutAttempt(),
			expected: "pack topup_1000 does not match checkout attempt",
			name: "attempt pack",
			session: checkoutSession({
				metadata: {
					...checkoutSession().metadata,
					packId: "topup_1000",
				},
			}),
		},
		{
			attempt: checkoutAttempt(),
			expected: "credits 1000 do not match top-up pack topup_250",
			name: "credits",
			session: checkoutSession({
				metadata: { ...checkoutSession().metadata, credits: "1000" },
			}),
		},
		{
			attempt: checkoutAttempt(),
			expected: "amount_total does not match top-up pack topup_250",
			name: "amount",
			session: checkoutSession({ amount_total: 2_499 }),
		},
		{
			attempt: checkoutAttempt(),
			expected: "currency does not match top-up pack topup_250",
			name: "currency",
			session: checkoutSession({ currency: "eur" }),
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
