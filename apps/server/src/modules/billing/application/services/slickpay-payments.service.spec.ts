import { NotFoundException } from "@nestjs/common";
import type {
	ProductSettings,
	SlickpayInvoiceDetailsResponse,
	StartSlickpayCheckoutBody,
} from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import { ManualSubscriptionUnsupportedError } from "../../domain/errors/manual-billing.errors";
import { SlickpayTooManyCheckoutsError } from "../../domain/errors/slickpay.errors";
import type { BillingCheckoutAttemptTransaction } from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import type { ManualSubscriptionPaymentRow } from "../../infrastructure/persistence/manual-subscription-payments.repository";
import type {
	InsertSlickpayPaymentInput,
	SlickpayPaymentChanges,
	SlickpayPaymentRow,
} from "../../infrastructure/persistence/slickpay-payments.repository";
import type { SubscriptionRow } from "../../infrastructure/persistence/subscriptions.repository";
import { SlickpayPaymentsService } from "./slickpay-payments.service";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const HOUR_MS = 60 * 60_000;
const PAYMENT_ID = "11111111-1111-4111-8111-111111111111";
const SUBSCRIPTION_ID = "22222222-2222-4222-8222-222222222222";
const GRANTED_SUBSCRIPTION_ID = "33333333-3333-4333-8333-333333333333";
const INVOICE_ID = "901";
const PAYMENT_URL = "https://devapi.slick-pay.com/satim/payment/abc";
const USER = { email: "amina@example.com", id: "user_1" };
// SAFETY: the fake repositories in this spec never read the transaction.
const TRANSACTION = {} as BillingCheckoutAttemptTransaction;

const CHECKOUT_BODY: StartSlickpayCheckoutBody = {
	city: "Oran",
	fullName: "Amina Ben Ali",
	interval: "month",
	phone: "+213 661 22 33 44",
	plan: "pro",
	tierCredits: 250,
};

// Pro 250 monthly is 25 USD. At 270.00 DZD per USD, SlickPay charges 6750 DZD.
const EXPECTED_PAYMENT = {
	amountMinor: 675_000,
	currency: "DZD",
	method: "slickpay",
	note: `SlickPay invoice ${INVOICE_ID}`,
	reference: INVOICE_ID,
};

function paymentRow(
	overrides: Partial<SlickpayPaymentRow> = {},
): SlickpayPaymentRow {
	return {
		amountDzd: 6750,
		createdAt: new Date(NOW.getTime() - HOUR_MS),
		dzdPerUsdRate: 27_000,
		fulfilledAt: null,
		id: PAYMENT_ID,
		interval: "month",
		invoiceId: INVOICE_ID,
		lastError: null,
		organizationId: null,
		paidAt: null,
		paymentUrl: PAYMENT_URL,
		plan: "pro",
		status: "pending",
		subscriptionId: null,
		tierCredits: 250,
		updatedAt: new Date(NOW.getTime() - HOUR_MS),
		userId: USER.id,
		...overrides,
	};
}

function subscriptionRow(
	overrides: Partial<SubscriptionRow> = {},
): SubscriptionRow {
	return {
		cancelAtPeriodEnd: false,
		createdAt: new Date("2026-09-06T12:00:00.000Z"),
		currentPeriodEnd: new Date("2026-11-06T12:00:00.000Z"),
		currentPeriodStart: new Date("2026-10-06T12:00:00.000Z"),
		id: SUBSCRIPTION_ID,
		interval: "month",
		organizationId: null,
		pendingAppliedBy: null,
		pendingInterval: null,
		pendingPlan: null,
		pendingTierCredits: null,
		plan: "pro",
		priceLookupKey: "pro_250_month",
		provider: "manual",
		providerSubscriptionId: "manual_55555555-5555-4555-8555-555555555555",
		status: "active",
		tierCredits: 250,
		updatedAt: new Date("2026-10-06T12:00:00.000Z"),
		userId: USER.id,
		...overrides,
	};
}

function manualPaymentRow(
	overrides: Partial<ManualSubscriptionPaymentRow> = {},
): ManualSubscriptionPaymentRow {
	return {
		amountMinor: 675_000,
		createdAt: NOW,
		currency: "DZD",
		id: "44444444-4444-4444-8444-444444444444",
		idempotencyKey: PAYMENT_ID,
		kind: "renewal",
		method: "slickpay",
		note: null,
		periodEnd: new Date("2026-12-06T12:00:00.000Z"),
		periodStart: new Date("2026-11-06T12:00:00.000Z"),
		recordedByUserId: USER.id,
		reference: INVOICE_ID,
		requestId: null,
		subscriptionId: SUBSCRIPTION_ID,
		...overrides,
	};
}

function productSettings(): ProductSettings {
	return {
		dzdPerUsdRate: 27_000,
		emailAuthEnabled: false,
		id: 1,
		lifecycleEmailsEnabled: false,
		manualGraceDays: 0,
		manualPaymentsEnabled: true,
		organizationsEnabled: false,
		paidSubscriptionsEnabled: true,
		signupGrantCredits: 700,
		signupGrantEnabled: false,
		topupsEnabled: true,
		updatedAt: NOW.toISOString(),
		updatedByUserId: null,
		v2BuilderEnabled: false,
		version: 1,
	};
}

type ContextOptions = {
	/** Rows in `slickpay_payments` before the call. */
	rows?: SlickpayPaymentRow[];
	/** The live subscription of the billing owner. */
	subscription?: SubscriptionRow;
	/** Rows in `manual_subscription_payments`. */
	recordedPayments?: ManualSubscriptionPaymentRow[];
	/** The SlickPay answer for GET merchants/invoices/{id}. Default: not paid. */
	invoice?: SlickpayInvoiceDetailsResponse;
	/** When set, GET merchants/invoices/{id} throws it, like a SlickPay timeout. */
	invoiceError?: Error;
	/** Checkouts of the user in the last 10 minutes. */
	recentCheckouts?: number;
};

function createContext(options: ContextOptions = {}) {
	const rows = new Map((options.rows ?? []).map((row) => [row.id, row]));
	const recorded = options.recordedPayments ?? [];
	const payments = {
		claimInvoiceCheck: async (id: string, writtenBefore: Date) => {
			const row = rows.get(id);

			if (
				!row ||
				(row.status !== "pending" && row.status !== "expired") ||
				row.updatedAt >= writtenBefore
			) {
				return null;
			}

			const claimed = { ...row, updatedAt: NOW };
			rows.set(id, claimed);

			return claimed;
		},
		countByUserSince: async () => options.recentCheckouts ?? 0,
		findById: async (id: string) => rows.get(id) ?? null,
		insert: async (input: InsertSlickpayPaymentInput) => {
			const row = paymentRow({
				...input,
				createdAt: NOW,
				invoiceId: null,
				paymentUrl: null,
				status: "created",
			});
			rows.set(row.id, row);

			return row;
		},
		listOpen: async () => [...rows.values()],
		updateIfStatus: async (
			id: string,
			from: SlickpayPaymentRow["status"],
			changes: SlickpayPaymentChanges,
		) => {
			const row = rows.get(id);

			if (!row || row.status !== from) {
				return null;
			}

			const updated = { ...row, ...changes, updatedAt: NOW };
			rows.set(id, updated);

			return updated;
		},
	};
	const slickpay = {
		createInvoice: vi.fn(async () => ({
			id: INVOICE_ID,
			success: 1 as const,
			url: PAYMENT_URL,
		})),
		getInvoice: vi.fn(async (): Promise<SlickpayInvoiceDetailsResponse> => {
			if (options.invoiceError) {
				throw options.invoiceError;
			}

			return options.invoice ?? { completed: 0, success: 1 };
		}),
	};
	const manualSubscriptions = {
		grant: vi.fn(async () => ({ id: GRANTED_SUBSCRIPTION_ID })),
		renew: vi.fn(async (_adminId: string, subscriptionId: string) => ({
			id: subscriptionId,
		})),
	};
	const service = new SlickpayPaymentsService(
		payments,
		slickpay,
		manualSubscriptions,
		{
			findByIdempotencyKey: async (key: string) =>
				recorded.find((payment) => payment.idempotencyKey === key) ?? null,
			findSlickpayByReference: async (invoiceId: string) =>
				recorded.find(
					(payment) =>
						payment.method === "slickpay" && payment.reference === invoiceId,
				) ?? null,
		},
		{ findActiveByOwner: async () => options.subscription ?? null },
		{
			findOpenForOwner: async () => [],
			withUserLock: async <T>(
				_userId: string,
				fn: (tx: BillingCheckoutAttemptTransaction) => Promise<T>,
			) => fn(TRANSACTION),
		},
		{ get: async () => productSettings() },
	);

	return { manualSubscriptions, rows, service, slickpay };
}

describe("SlickpayPaymentsService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("startCheckout", () => {
		it("charges whole DZD at the stored centi-DZD rate and saves the invoice", async () => {
			const context = createContext();

			await expect(
				context.service.startCheckout(USER, CHECKOUT_BODY),
			).resolves.toEqual({ paymentId: PAYMENT_ID, url: PAYMENT_URL });
			expect(context.slickpay.createInvoice).toHaveBeenCalledWith(
				expect.objectContaining({ amountDzd: 6750 }),
			);
			expect(context.rows.get(PAYMENT_ID)).toMatchObject({
				amountDzd: 6750,
				dzdPerUsdRate: 27_000,
				invoiceId: INVOICE_ID,
				status: "pending",
			});
		});

		it.each([
			[
				"a live Stripe subscription",
				{ subscription: subscriptionRow({ provider: "stripe" }) },
				ActiveSubscriptionExistsError,
			],
			[
				"a manual subscription with another tier",
				{ subscription: subscriptionRow({ tierCredits: 500 }) },
				ManualSubscriptionUnsupportedError,
			],
			[
				"5 checkouts in the last 10 minutes",
				{ recentCheckouts: 5 },
				SlickpayTooManyCheckoutsError,
			],
		])("refuses an owner with %s before SlickPay creates an invoice", async (_label, options, expectedError) => {
			const context = createContext(options);

			await expect(
				context.service.startCheckout(USER, CHECKOUT_BODY),
			).rejects.toBeInstanceOf(expectedError);
			expect(context.slickpay.createInvoice).not.toHaveBeenCalled();
			expect(context.rows.size).toBe(0);
		});
	});

	describe("refresh", () => {
		it("moves a paid invoice from pending to paid to fulfilled with a grant", async () => {
			const context = createContext({
				invoice: { completed: 1, success: 1 },
				rows: [paymentRow()],
			});

			await expect(
				context.service.refresh(paymentRow()),
			).resolves.toMatchObject({
				fulfilledAt: NOW,
				paidAt: NOW,
				status: "fulfilled",
				subscriptionId: GRANTED_SUBSCRIPTION_ID,
			});
			expect(context.manualSubscriptions.grant).toHaveBeenCalledWith(USER.id, {
				idempotencyKey: PAYMENT_ID,
				interval: "month",
				organizationId: null,
				payment: EXPECTED_PAYMENT,
				plan: "pro",
				tierCredits: 250,
				userId: USER.id,
			});
		});

		it.each([
			["25 h", "expired", 25 * HOUR_MS],
			["23 h", "pending", 23 * HOUR_MS],
		])("sets an unpaid invoice created %s ago to %s", async (_label, expectedStatus, ageMs) => {
			const row = paymentRow({ createdAt: new Date(NOW.getTime() - ageMs) });
			const context = createContext({ rows: [row] });

			await expect(context.service.refresh(row)).resolves.toMatchObject({
				status: expectedStatus,
			});
		});

		it("fulfills a paid invoice when a parallel sweep expires the row during the SlickPay call", async () => {
			const row = paymentRow({
				createdAt: new Date(NOW.getTime() - 25 * HOUR_MS),
			});
			const context = createContext({ rows: [row] });
			context.slickpay.getInvoice.mockImplementationOnce(async () => {
				context.rows.set(PAYMENT_ID, { ...row, status: "expired" });

				return { completed: 1, success: 1 };
			});

			await expect(context.service.refresh(row)).resolves.toMatchObject({
				paidAt: NOW,
				status: "fulfilled",
				subscriptionId: GRANTED_SUBSCRIPTION_ID,
			});
		});

		it("keeps an unpaid invoice older than 24 h pending when SlickPay does not answer", async () => {
			const row = paymentRow({
				createdAt: new Date(NOW.getTime() - 25 * HOUR_MS),
			});
			const context = createContext({
				invoiceError: new Error("SlickPay timeout"),
				rows: [row],
			});

			await expect(context.service.refresh(row)).rejects.toThrow(
				"SlickPay timeout",
			);
			expect(context.rows.get(PAYMENT_ID)).toMatchObject({
				lastError: expect.stringContaining("SlickPay timeout"),
				status: "pending",
			});
		});

		it("renews a manual subscription with the same plan, the pending tier, and the same cycle", async () => {
			const row = paymentRow({ paidAt: NOW, status: "paid" });
			const context = createContext({
				rows: [row],
				subscription: subscriptionRow({
					pendingTierCredits: 250,
					tierCredits: 175,
				}),
			});

			await expect(context.service.refresh(row)).resolves.toMatchObject({
				status: "fulfilled",
				subscriptionId: SUBSCRIPTION_ID,
			});
			expect(context.manualSubscriptions.renew).toHaveBeenCalledWith(
				USER.id,
				SUBSCRIPTION_ID,
				{ idempotencyKey: PAYMENT_ID, payment: EXPECTED_PAYMENT },
			);
			expect(context.manualSubscriptions.grant).not.toHaveBeenCalled();
		});

		it.each([
			["a Stripe subscription", subscriptionRow({ provider: "stripe" })],
			[
				"a manual subscription with another cycle",
				subscriptionRow({ interval: "year" }),
			],
		])("keeps a paid row paid with last_error when the owner has %s", async (_label, subscription) => {
			const row = paymentRow({ paidAt: NOW, status: "paid" });
			const context = createContext({ rows: [row], subscription });

			await expect(context.service.refresh(row)).resolves.toMatchObject({
				lastError: expect.stringContaining("An admin must resolve"),
				status: "paid",
				subscriptionId: null,
			});
			expect(context.manualSubscriptions.grant).not.toHaveBeenCalled();
			expect(context.manualSubscriptions.renew).not.toHaveBeenCalled();
		});

		it.each([
			["the row id as idempotency key", manualPaymentRow()],
			[
				"the invoice id as admin reference",
				manualPaymentRow({ idempotencyKey: "admin-submission-key" }),
			],
		])("does not renew again when a manual payment with %s exists", async (_label, recordedPayment) => {
			const row = paymentRow({ paidAt: NOW, status: "paid" });
			const context = createContext({
				recordedPayments: [recordedPayment],
				rows: [row],
				subscription: subscriptionRow(),
			});

			await expect(context.service.refresh(row)).resolves.toMatchObject({
				status: "fulfilled",
				subscriptionId: SUBSCRIPTION_ID,
			});
			expect(context.manualSubscriptions.grant).not.toHaveBeenCalled();
			expect(context.manualSubscriptions.renew).not.toHaveBeenCalled();
		});
	});

	describe("confirm", () => {
		it("answers 404 for a payment of another user", async () => {
			const context = createContext({
				rows: [paymentRow({ userId: "user_2" })],
			});

			await expect(
				context.service.confirm(USER, PAYMENT_ID),
			).rejects.toBeInstanceOf(NotFoundException);
			expect(context.slickpay.getInvoice).not.toHaveBeenCalled();
		});

		it.each([
			["1 s ago", 0, 1_000],
			["3 s ago", 1, 3_000],
		])("for a pending row checked %s, asks SlickPay %i times", async (_label, expectedCalls, checkedAgoMs) => {
			const row = paymentRow({
				updatedAt: new Date(NOW.getTime() - checkedAgoMs),
			});
			const context = createContext({ rows: [row] });

			await expect(
				context.service.confirm(USER, PAYMENT_ID),
			).resolves.toMatchObject({ status: "pending" });
			expect(context.slickpay.getInvoice).toHaveBeenCalledTimes(expectedCalls);
		});

		it("fulfills an expired row when the buyer paid after the expiry", async () => {
			const context = createContext({
				invoice: { completed: 1, success: 1 },
				rows: [
					paymentRow({
						createdAt: new Date(NOW.getTime() - 25 * HOUR_MS),
						status: "expired",
					}),
				],
			});

			await expect(
				context.service.confirm(USER, PAYMENT_ID),
			).resolves.toMatchObject({
				status: "fulfilled",
				subscriptionId: GRANTED_SUBSCRIPTION_ID,
			});
		});
	});
});
