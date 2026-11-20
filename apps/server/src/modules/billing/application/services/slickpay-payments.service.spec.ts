import { NotFoundException } from "@nestjs/common";
import type {
	ProductSettings,
	SlickpayInvoiceDetailsResponse,
	StartSlickpayCheckoutBody,
} from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreditOwner } from "../../../credits/domain/credit-owner";
import type { CreditLedgerRow } from "../../../credits/infrastructure/persistence/credits.repository";
import { SlickpayTooManyCheckoutsError } from "../../domain/errors/slickpay.errors";
import type { BillingCheckoutAttemptTransaction } from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import type {
	BillingTopupReceiptRow,
	InsertBillingTopupReceipt,
} from "../../infrastructure/persistence/billing-topup-receipts.repository";
import type { ManualSubscriptionPaymentRow } from "../../infrastructure/persistence/manual-subscription-payments.repository";
import type {
	InsertSlickpayPaymentInput,
	SlickpayPaymentChanges,
	SlickpayPaymentRow,
} from "../../infrastructure/persistence/slickpay-payments.repository";
import type { SubscriptionCreditsTransaction } from "../../infrastructure/persistence/subscription-credits.repository";
import { SlickpayPaymentsService } from "./slickpay-payments.service";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const HOUR_MS = 60 * 60_000;
const PAYMENT_ID = "11111111-1111-4111-8111-111111111111";
const SUBSCRIPTION_ID = "22222222-2222-4222-8222-222222222222";
const INVOICE_ID = "901";
const PAYMENT_URL = "https://devapi.slick-pay.com/satim/payment/abc";
const USER = { email: "amina@example.com", id: "user_1" };
// SAFETY: the fake repositories in this spec never read the transaction.
const TRANSACTION = {} as BillingCheckoutAttemptTransaction;
// SAFETY: the fake repositories in this spec never read the transaction.
const OWNER_TRANSACTION = {} as SubscriptionCreditsTransaction;

const CHECKOUT_BODY: StartSlickpayCheckoutBody = {
	amountUsd: 25,
	city: "Oran",
	fullName: "Amina Ben Ali",
	phone: "+213 661 22 33 44",
};

// A pricing v8 row: 25 USD at 270.00 DZD per USD is 6750 DZD and 250 credits.
function paymentRow(
	overrides: Partial<SlickpayPaymentRow> = {},
): SlickpayPaymentRow {
	return {
		amountDzd: 6750,
		amountUsdCents: 2500,
		createdAt: new Date(NOW.getTime() - HOUR_MS),
		credits: 25_000,
		dzdPerUsdRate: 27_000,
		fulfilledAt: null,
		id: PAYMENT_ID,
		interval: null,
		invoiceId: INVOICE_ID,
		lastError: null,
		organizationId: null,
		paidAt: null,
		paymentUrl: PAYMENT_URL,
		plan: null,
		status: "pending",
		subscriptionId: null,
		tierCredits: null,
		updatedAt: new Date(NOW.getTime() - HOUR_MS),
		userId: USER.id,
		...overrides,
	};
}

// A row from before pricing v8: a plan, no amount columns.
function oldPaymentRow(
	overrides: Partial<SlickpayPaymentRow> = {},
): SlickpayPaymentRow {
	return paymentRow({
		amountUsdCents: null,
		credits: null,
		interval: "month",
		paidAt: NOW,
		plan: "pro",
		status: "paid",
		tierCredits: 250,
		...overrides,
	});
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
		kind: "initial",
		method: "slickpay",
		note: null,
		periodEnd: new Date("2026-11-06T12:00:00.000Z"),
		periodStart: NOW,
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
		userReferralActivationCredits: 1000,
		userReferralFriendCredits: 1000,
		userReferralPaidCredits: 10_000,
		userReferralsEnabled: false,
		v2BuilderEnabled: false,
		version: 1,
	};
}

/** In-memory credit ledger with the replay rule of CreditsService.topup: same key, same owner and amount. */
class FakeLedger {
	readonly rows: CreditLedgerRow[] = [];

	async topup(
		owner: CreditOwner,
		amount: number,
		options: { idempotencyKey?: string } = {},
	): Promise<CreditLedgerRow> {
		const ownerColumns =
			owner.type === "user"
				? { organizationId: null, userId: owner.userId }
				: { organizationId: owner.organizationId, userId: null };
		const existing = this.rows.find(
			(row) => row.idempotencyKey === options.idempotencyKey,
		);

		if (existing) {
			if (
				existing.delta !== amount ||
				existing.userId !== ownerColumns.userId ||
				existing.organizationId !== ownerColumns.organizationId
			) {
				throw new Error("Top-up idempotency key replayed with other values");
			}

			return existing;
		}

		const row = {
			bucket: "topup",
			createdAt: NOW,
			delta: amount,
			id: `ledger_${this.rows.length + 1}`,
			idempotencyKey: options.idempotencyKey ?? null,
			kind: "topup",
			meta: null,
			...ownerColumns,
		} satisfies CreditLedgerRow;

		this.rows.push(row);

		return row;
	}
}

type ContextOptions = {
	/** Rows in `slickpay_payments` before the call. */
	rows?: SlickpayPaymentRow[];
	/** Rows in `manual_subscription_payments`. */
	recordedPayments?: ManualSubscriptionPaymentRow[];
	/** The SlickPay answer for GET merchants/invoices/{id}. Default: not paid. */
	invoice?: SlickpayInvoiceDetailsResponse;
	/** When set, GET merchants/invoices/{id} throws it, like a SlickPay timeout. */
	invoiceError?: Error;
	/** Checkouts of the user in the last 10 minutes. */
	recentCheckouts?: number;
	/** When true, old code grants the row as a plan without the owner lock, just before the grant sets "fulfilled". */
	fulfilledByOldCode?: boolean;
};

function createContext(options: ContextOptions = {}) {
	const rows = new Map((options.rows ?? []).map((row) => [row.id, row]));
	const recorded = options.recordedPayments ?? [];
	const ledger = new FakeLedger();
	const receipts = new Map<string, BillingTopupReceiptRow>();
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
			const before = rows.get(id);

			// Old code in the deploy window commits its own write first, outside the grant transaction.
			if (
				options.fulfilledByOldCode &&
				before &&
				changes.status === "fulfilled"
			) {
				rows.set(id, {
					...before,
					fulfilledAt: NOW,
					status: "fulfilled",
					subscriptionId: SUBSCRIPTION_ID,
				});
			}

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
	const service = new SlickpayPaymentsService(
		payments,
		slickpay,
		{
			findByIdempotencyKey: async (key: string) =>
				recorded.find((payment) => payment.idempotencyKey === key) ?? null,
			findSlickpayByReference: async (invoiceId: string) =>
				recorded.find(
					(payment) =>
						payment.method === "slickpay" && payment.reference === invoiceId,
				) ?? null,
		},
		{
			withOwnerLock: async <T>(
				_owner: CreditOwner,
				fn: (tx: SubscriptionCreditsTransaction) => Promise<T>,
			): Promise<T> => {
				// A thrown error rolls the transaction back, like Postgres does.
				const ledgerLength = ledger.rows.length;
				const receiptSnapshot = new Map(receipts);

				try {
					return await fn(OWNER_TRANSACTION);
				} catch (error) {
					ledger.rows.splice(ledgerLength);
					receipts.clear();
					for (const [key, receipt] of receiptSnapshot) {
						receipts.set(key, receipt);
					}

					throw error;
				}
			},
		},
		ledger,
		{
			insertIfAbsent: async (input: InsertBillingTopupReceipt) => {
				if (receipts.has(input.providerReference)) {
					return null;
				}

				const row: BillingTopupReceiptRow = {
					amountUsdCents: null,
					chargeId: null,
					createdAt: NOW,
					credits: null,
					id: `receipt_${receipts.size + 1}`,
					method: null,
					note: null,
					organizationId: null,
					packId: null,
					paymentIntentId: null,
					provider: "stripe",
					recordedByUserId: null,
					reference: null,
					requestId: null,
					reversedAt: null,
					reversedByUserId: null,
					...input,
				};
				receipts.set(input.providerReference, row);

				return row;
			},
		},
		{ enqueue: async () => null },
		{
			withUserLock: async <T>(
				_userId: string,
				fn: (tx: BillingCheckoutAttemptTransaction) => Promise<T>,
			) => fn(TRANSACTION),
		},
		{ get: async () => productSettings() },
	);

	return { ledger, receipts, rows, service, slickpay };
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
		it("stores the credits and the DZD price at checkout, with no plan", async () => {
			const context = createContext();

			await expect(
				context.service.startCheckout(USER, CHECKOUT_BODY),
			).resolves.toEqual({ paymentId: PAYMENT_ID, url: PAYMENT_URL });
			expect(context.slickpay.createInvoice).toHaveBeenCalledWith(
				expect.objectContaining({
					amountDzd: 6750,
					itemName: "Wandit credits",
				}),
			);
			expect(context.rows.get(PAYMENT_ID)).toMatchObject({
				amountDzd: 6750,
				amountUsdCents: 2500,
				credits: 25_000,
				dzdPerUsdRate: 27_000,
				invoiceId: INVOICE_ID,
				plan: null,
				status: "pending",
			});
		});

		it("refuses a user with 5 checkouts in the last 10 minutes before SlickPay creates an invoice", async () => {
			const context = createContext({ recentCheckouts: 5 });

			await expect(
				context.service.startCheckout(USER, CHECKOUT_BODY),
			).rejects.toBeInstanceOf(SlickpayTooManyCheckoutsError);
			expect(context.slickpay.createInvoice).not.toHaveBeenCalled();
			expect(context.rows.size).toBe(0);
		});
	});

	describe("refresh", () => {
		it("tops up once and writes one receipt when two refreshes fulfil the same paid row", async () => {
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
			});
			// The sweep still holds the "paid" row it read before the confirm route fulfilled it.
			await context.service.refresh(
				paymentRow({ paidAt: NOW, status: "paid" }),
			);

			expect(context.ledger.rows).toEqual([
				expect.objectContaining({
					delta: 25_000,
					idempotencyKey: `slickpay-topup:${PAYMENT_ID}`,
					userId: USER.id,
				}),
			]);
			expect([...context.receipts.values()]).toEqual([
				expect.objectContaining({
					amountCents: 675_000,
					amountUsdCents: 2500,
					credits: 25_000,
					currency: "dzd",
					provider: "slickpay",
					providerReference: `slickpay:${PAYMENT_ID}`,
					recordedByUserId: null,
					reference: INVOICE_ID,
				}),
			]);
		});

		it("rolls back the top-up and the receipt when old code fulfils the row during the grant", async () => {
			const row = paymentRow({ paidAt: NOW, status: "paid" });
			const context = createContext({ fulfilledByOldCode: true, rows: [row] });

			await expect(context.service.refresh(row)).resolves.toMatchObject({
				status: "fulfilled",
				subscriptionId: SUBSCRIPTION_ID,
			});
			expect(context.ledger.rows).toHaveLength(0);
			expect(context.receipts.size).toBe(0);
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
			});
			expect(context.ledger.rows).toHaveLength(1);
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

		it.each([
			["the row id as idempotency key", manualPaymentRow()],
			[
				"the invoice id as admin reference",
				manualPaymentRow({ idempotencyKey: "admin-submission-key" }),
			],
		])("grants nothing for an old row when a plan payment with %s exists", async (_label, recordedPayment) => {
			const row = oldPaymentRow();
			const context = createContext({
				recordedPayments: [recordedPayment],
				rows: [row],
			});

			await expect(context.service.refresh(row)).resolves.toMatchObject({
				status: "fulfilled",
				subscriptionId: SUBSCRIPTION_ID,
			});
			expect(context.ledger.rows).toHaveLength(0);
			expect(context.receipts.size).toBe(0);
		});

		// The larger of the plan credits (x12 for a yearly row) and 10 credits per USD of the DZD amount.
		it.each([
			["Pro 250 monthly, 6750 DZD", {}, 25_000],
			[
				"Business 250 monthly, 13500 DZD (the DZD value wins)",
				{ amountDzd: 13_500, plan: "business" as const },
				50_000,
			],
			[
				"Pro 250 yearly, 67500 DZD (the 12 allotments win)",
				{ amountDzd: 67_500, interval: "year" as const },
				300_000,
			],
			[
				"Pro 250 monthly, 6750 DZD at 300.00 DZD per USD (the plan wins)",
				{ dzdPerUsdRate: 30_000 },
				25_000,
			],
		])("grants an old row with no plan payment: %s", async (_label, overrides, expectedCentiCredits) => {
			const row = oldPaymentRow(overrides);
			const context = createContext({ rows: [row] });

			await expect(context.service.refresh(row)).resolves.toMatchObject({
				status: "fulfilled",
			});
			expect(context.ledger.rows).toEqual([
				expect.objectContaining({ delta: expectedCentiCredits }),
			]);
			expect([...context.receipts.values()]).toEqual([
				expect.objectContaining({ credits: expectedCentiCredits }),
			]);
		});

		it("keeps a row paid with last_error when it would grant zero credits", async () => {
			// 1 DZD at 10000.00 DZD per USD is 0.1 centi-credits, and the row has no plan.
			const row = oldPaymentRow({
				amountDzd: 1,
				dzdPerUsdRate: 1_000_000,
				interval: null,
				plan: null,
				tierCredits: null,
			});
			const context = createContext({ rows: [row] });

			await expect(context.service.refresh(row)).resolves.toMatchObject({
				lastError: expect.stringContaining("zero credits"),
				status: "paid",
			});
			expect(context.ledger.rows).toHaveLength(0);
			expect(context.receipts.size).toBe(0);
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
				amountUsd: 25,
				credits: 250,
				status: "fulfilled",
			});
		});
	});
});
