import { ConflictException } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type { CreateBillingTopupBody } from "@wandit/contracts";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreditOwner } from "../../../credits/domain/credit-owner";
import { AmbiguousPaymentProviderWriteError } from "../../domain/errors/ambiguous-payment-provider-write.error";
import type { CreateTopupCheckoutParams } from "../../domain/ports/payment-provider.port";
import type {
	BillingCheckoutAttemptRow,
	BillingCheckoutAttemptTransaction,
} from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import type { BillingCustomerRow } from "../../infrastructure/persistence/billing-customers.repository";
import type { BillingTopupReceiptWithRevoked } from "../../infrastructure/persistence/billing-topup-receipts.repository";
import type { SlickpayPaymentRow } from "../../infrastructure/persistence/slickpay-payments.repository";
import { BillingService } from "./billing.service";

const NOW = new Date("2026-11-12T12:00:00.000Z");
const OLD_ATTEMPT_ID = "44444444-4444-4444-8444-444444444444";
const MINUTE_MS = 60_000;

// SAFETY: the fakes below never read the transaction handle.
const TX = {} as BillingCheckoutAttemptTransaction;

// SAFETY: each fake implements every member that BillingService calls in these cases.
function stub<T extends object>(fake: Partial<NoInfer<T>>): T {
	return fake as T;
}

const user = stub<AuthUser>({ email: "user@example.com", id: "user_1" });

function checkoutAttempt(
	overrides: Partial<BillingCheckoutAttemptRow> = {},
): BillingCheckoutAttemptRow {
	return {
		amountUsdCents: 2_500,
		createdAt: new Date(NOW),
		credits: 25_000,
		id: OLD_ATTEMPT_ID,
		organizationId: null,
		packId: null,
		priceLookupKey: null,
		providerSessionId: null,
		purpose: "topup",
		status: "created",
		updatedAt: new Date(NOW),
		userId: user.id,
		...overrides,
	};
}

class FakeCheckoutAttempts {
	rows: BillingCheckoutAttemptRow[] = [];

	readonly create = vi.fn(
		async (input: {
			amountUsdCents: number;
			credits: number;
			id: string;
			organizationId: string | null;
			userId: string;
		}) => {
			const row = checkoutAttempt({
				amountUsdCents: input.amountUsdCents,
				credits: input.credits,
				id: input.id,
				organizationId: input.organizationId,
				userId: input.userId,
			});
			this.rows.push(row);

			return row;
		},
	);
	readonly markExpired = vi.fn(async (id: string) => {
		this.rows = this.rows.map((row) =>
			row.id === id ? { ...row, status: "expired" } : row,
		);

		return true;
	});

	async findOpenForOwner(
		_owner: CreditOwner,
		purpose: "subscription" | "topup",
	) {
		return this.rows.filter(
			(row) =>
				row.purpose === purpose &&
				(row.status === "created" || row.status === "session_attached"),
		);
	}

	async attachSession(id: string, providerSessionId: string) {
		const row = this.rows.find((candidate) => candidate.id === id);

		if (!row) {
			return null;
		}

		const attached = {
			...row,
			providerSessionId,
			status: "session_attached" as const,
		};
		this.rows = this.rows.map((candidate) =>
			candidate.id === id ? attached : candidate,
		);

		return attached;
	}

	withOwnerLock<T>(
		_owner: CreditOwner,
		operation: (tx: BillingCheckoutAttemptTransaction) => Promise<T>,
	): Promise<T> {
		return operation(TX);
	}

	withUserLock<T>(
		_userId: string,
		operation: (tx: BillingCheckoutAttemptTransaction) => Promise<T>,
	): Promise<T> {
		return operation(TX);
	}
}

function setup(
	input: {
		/** Status that Stripe answers when the service expires an open session. */
		expireStatus?: Stripe.Checkout.Session["status"];
		receipts?: BillingTopupReceiptWithRevoked[];
		/** What the credit snapshot of the pool answers. */
		starterPassRequired?: boolean;
		/** Open SlickPay Starter pass rows of the pool. The fake filters them only by age. */
		slickpayStarterPasses?: SlickpayPaymentRow[];
	} = {},
) {
	const attempts = new FakeCheckoutAttempts();
	const provider = {
		createTopupCheckout: vi.fn(async (_params: CreateTopupCheckoutParams) => ({
			id: "cs_new",
			url: "https://checkout.stripe.test/cs_new",
		})),
		expireCheckoutSession: vi.fn(
			async (_sessionId: string) => input.expireStatus ?? "expired",
		),
	};
	const customer = stub<BillingCustomerRow>({ providerCustomerId: "cus_1" });
	const credits = {
		getSettledBalance: async () => ({
			balance: 0,
			plan: 0,
			promo: 0,
			settledBalance: 0,
			settledPlan: 0,
			settledPromo: 0,
			settledTopup: 0,
			starterPassRequired: input.starterPassRequired ?? false,
			topup: 0,
		}),
	};
	const service = new BillingService(
		stub({}),
		stub({}),
		stub(credits),
		stub(provider),
		stub({ ensureCustomer: async () => customer }),
		stub(attempts),
		stub({}),
		stub({}),
		stub({}),
		stub({ listRecentForOwner: async () => input.receipts ?? [] }),
		{
			findOpenStarterPasses: async (_owner: CreditOwner, createdAfter: Date) =>
				(input.slickpayStarterPasses ?? []).filter(
					(row) => row.createdAt > createdAfter,
				),
		},
	);

	return { attempts, provider, service };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("BillingService top-up checkout", () => {
	it.each([
		// Below the first bonus tier: no bonus.
		{
			amountUsdCents: 2_500,
			baseCredits: 250,
			body: { amountUsd: 25 },
			bonusCredits: 0,
			credits: 25_000,
		},
		// Top tier, +15%: 10,000 base credits and 1,500 bonus credits.
		{
			amountUsdCents: 100_000,
			baseCredits: 10_000,
			body: { amountUsd: 1_000 },
			bonusCredits: 1_500,
			credits: 1_150_000,
		},
		// A cached v7 bundle: the pack price (250 USD) enters the amount flow at the v8.1 rate and bonus.
		{
			amountUsdCents: 25_000,
			baseCredits: 2_500,
			body: { packId: "topup_2500" },
			bonusCredits: 375,
			credits: 287_500,
		},
	] satisfies {
		amountUsdCents: number;
		baseCredits: number;
		body: CreateBillingTopupBody;
		bonusCredits: number;
		credits: number;
	}[])("stores %o in USD cents and centi-credits and charges the stored amount", async ({
		amountUsdCents,
		baseCredits,
		body,
		bonusCredits,
		credits,
	}) => {
		const { attempts, provider, service } = setup();

		await expect(service.topup(user, body)).resolves.toEqual({
			url: "https://checkout.stripe.test/cs_new",
		});

		const [attempt] = attempts.rows;
		expect(attempt).toMatchObject({ amountUsdCents, credits });
		expect(provider.createTopupCheckout).toHaveBeenCalledWith({
			amountUsdCents,
			attemptId: attempt?.id,
			baseCredits,
			bonusCredits,
			customerId: "cus_1",
			organizationId: null,
			requestThreeDSecure: false,
			userId: user.id,
		});
	});

	it("sells the Starter pass at 1 USD for 10 credits with 3-D Secure when the pool needs it", async () => {
		const { attempts, provider, service } = setup({
			starterPassRequired: true,
		});

		await service.topup(user, { starterPass: true });

		expect(attempts.rows).toMatchObject([
			{ amountUsdCents: 100, credits: 1_000 },
		]);
		expect(provider.createTopupCheckout).toHaveBeenCalledWith(
			expect.objectContaining({
				amountUsdCents: 100,
				baseCredits: 10,
				requestThreeDSecure: true,
			}),
		);
	});

	it("answers 409 STARTER_PASS_NOT_AVAILABLE when the pool does not need the pass", async () => {
		const { attempts, provider, service } = setup({
			starterPassRequired: false,
		});

		await expect(
			service.topup(user, { starterPass: true }),
		).rejects.toMatchObject({
			response: { code: "STARTER_PASS_NOT_AVAILABLE" },
			status: 409,
		});
		expect(attempts.rows).toEqual([]);
		expect(provider.createTopupCheckout).not.toHaveBeenCalled();
	});

	// SlickPay cannot cancel an invoice, so a young SlickPay Starter pass invoice blocks a card Starter pass page.
	it.each([
		{
			body: { starterPass: true },
			code: "STARTER_PASS_SLICKPAY_OPEN",
			minutesOld: 10,
			name: "refuses a card Starter pass while a SlickPay Starter pass invoice is younger than 30 minutes",
		},
		{
			body: { starterPass: true },
			minutesOld: 31,
			name: "sells a card Starter pass when the SlickPay Starter pass invoice is older than 30 minutes",
		},
		{
			body: { amountUsd: 10 },
			minutesOld: 10,
			name: "sells a normal card top-up while a SlickPay Starter pass invoice is open",
		},
	] satisfies Array<{
		body: CreateBillingTopupBody;
		code?: string;
		minutesOld: number;
		name: string;
	}>)("$name", async ({ body, code, minutesOld }) => {
		const { attempts, provider, service } = setup({
			slickpayStarterPasses: [
				stub<SlickpayPaymentRow>({
					createdAt: new Date(NOW.getTime() - minutesOld * MINUTE_MS),
				}),
			],
			starterPassRequired: true,
		});
		const checkout = service.topup(user, body);

		if (code) {
			await expect(checkout).rejects.toMatchObject({
				response: { code },
				status: 409,
			});
			expect(attempts.rows).toEqual([]);
			expect(provider.createTopupCheckout).not.toHaveBeenCalled();
		} else {
			await expect(checkout).resolves.toEqual({
				url: "https://checkout.stripe.test/cs_new",
			});
		}
	});

	it("expires the open session of an attempt, then starts the new top-up", async () => {
		const { attempts, provider, service } = setup({ expireStatus: "expired" });
		attempts.rows.push(
			checkoutAttempt({
				providerSessionId: "cs_old",
				status: "session_attached",
			}),
		);

		await service.topup(user, { amountUsd: 10 });

		expect(provider.expireCheckoutSession).toHaveBeenCalledWith("cs_old");
		expect(attempts.rows.map((row) => row.status)).toEqual([
			"expired",
			"session_attached",
		]);
	});

	it("answers 409 when Stripe says the open session is complete, and keeps it fulfillable", async () => {
		const { attempts, provider, service } = setup({ expireStatus: "complete" });
		attempts.rows.push(
			checkoutAttempt({
				providerSessionId: "cs_old",
				status: "session_attached",
			}),
		);

		await expect(service.topup(user, { amountUsd: 10 })).rejects.toBeInstanceOf(
			ConflictException,
		);
		expect(attempts.rows.map((row) => row.status)).toEqual([
			"session_attached",
		]);
		expect(provider.createTopupCheckout).not.toHaveBeenCalled();
	});

	it("answers 409 while an attempt with no session is younger than 5 minutes", async () => {
		const { attempts, provider, service } = setup();
		attempts.rows.push(
			checkoutAttempt({ createdAt: new Date(NOW.getTime() - 4 * 60 * 1000) }),
		);

		await expect(service.topup(user, { amountUsd: 10 })).rejects.toBeInstanceOf(
			ConflictException,
		);
		expect(attempts.create).not.toHaveBeenCalled();
		expect(provider.expireCheckoutSession).not.toHaveBeenCalled();
	});

	it("ignores an attempt with no session after 5 minutes and never sets it to expired", async () => {
		const { attempts, provider, service } = setup();
		attempts.rows.push(
			checkoutAttempt({ createdAt: new Date(NOW.getTime() - 6 * 60 * 1000) }),
		);

		await service.topup(user, { amountUsd: 10 });

		expect(provider.expireCheckoutSession).not.toHaveBeenCalled();
		expect(attempts.markExpired).not.toHaveBeenCalled();
		expect(attempts.rows.map((row) => row.status)).toEqual([
			"created",
			"session_attached",
		]);
	});

	// Stripe can still create the session. The webhook attaches a paid session only to a "created" attempt.
	it("keeps the attempt created when Stripe gives an ambiguous failure", async () => {
		const { attempts, provider, service } = setup();
		const failure = new AmbiguousPaymentProviderWriteError("timeout", null);
		provider.createTopupCheckout.mockRejectedValueOnce(failure);

		await expect(service.topup(user, { amountUsd: 10 })).rejects.toBe(failure);
		expect(attempts.markExpired).not.toHaveBeenCalled();
		expect(attempts.rows.map((row) => row.status)).toEqual(["created"]);
	});

	it("expires the attempt when Stripe gives a definite failure", async () => {
		const { attempts, provider, service } = setup();
		const failure = new Error("card_declined");
		provider.createTopupCheckout.mockRejectedValueOnce(failure);

		await expect(service.topup(user, { amountUsd: 10 })).rejects.toBe(failure);
		expect(attempts.rows.map((row) => row.status)).toEqual(["expired"]);
	});

	it("expires the new session and the attempt when the attach step loses", async () => {
		const { attempts, provider, service } = setup();
		attempts.attachSession = async () => null;

		await expect(service.topup(user, { amountUsd: 10 })).rejects.toThrow(
			"could not attach its session",
		);
		expect(provider.expireCheckoutSession).toHaveBeenCalledWith("cs_new");
		expect(attempts.rows.map((row) => row.status)).toEqual(["expired"]);
	});
});

describe("BillingService payment history", () => {
	it("converts the receipt and revoked centi-credits to decimal credits", async () => {
		const receipt = {
			amountCents: 2_500,
			amountUsdCents: 2_500,
			chargeId: "ch_1",
			credits: 25_000,
			currency: "usd",
			id: "55555555-5555-4555-8555-555555555555",
			method: null,
			paidAt: new Date(NOW),
			provider: "stripe",
			reversedAt: null,
		};
		const { service } = setup({
			receipts: [
				{
					receipt: stub(receipt),
					revokedCentiCredits: 12_550,
				},
				{
					receipt: stub({ ...receipt, chargeId: null, credits: null }),
					revokedCentiCredits: null,
				},
			],
		});

		const { items } = await service.listPayments(user);

		expect(
			items.map(({ credits, revokedCredits }) => ({ credits, revokedCredits })),
		).toEqual([
			{ credits: 250, revokedCredits: 125.5 },
			{ credits: null, revokedCredits: null },
		]);
	});
});
