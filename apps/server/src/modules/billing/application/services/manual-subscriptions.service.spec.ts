import { BadRequestException, ConflictException } from "@nestjs/common";
import type { AdminRecordTopupInput, ProductSettings } from "@wandit/contracts";
import { OPEN_MANUAL_REQUEST_STATUSES } from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreditOwner } from "../../../credits/domain/credit-owner";
import type { CreditLedgerRow } from "../../../credits/infrastructure/persistence/credits.repository";
import type {
	AdminTopupReceiptRow,
	BillingTopupReceiptRow,
	InsertBillingTopupReceipt,
} from "../../infrastructure/persistence/billing-topup-receipts.repository";
import type {
	AdminManualRequestRow,
	ManualSubscriptionRequestRow,
	UpdateManualSubscriptionRequestInput,
} from "../../infrastructure/persistence/manual-subscription-requests.repository";
import type { StarterPassGrant } from "../../infrastructure/persistence/starter-passes.repository";
import type { SubscriptionCreditsTransaction } from "../../infrastructure/persistence/subscription-credits.repository";
import type { ManualBillingOwnerRow } from "../../infrastructure/persistence/subscriptions.repository";
import {
	ManualSubscriptionsService,
	offlineTopupAmounts,
} from "./manual-subscriptions.service";

const NOW = new Date("2026-11-12T12:00:00.000Z");
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "44444444-4444-4444-8444-444444444444";
const ADMIN_ID = "admin_1";
// SAFETY: the fake repositories in this spec never read the transaction.
const TRANSACTION = {} as SubscriptionCreditsTransaction;

const USER = {
	email: "owner@example.com",
	id: "user_1",
	image: null,
	name: "Owner",
};

function productSettings(): ProductSettings {
	return {
		dzdPerUsdRate: 27_000,
		emailAuthEnabled: false,
		id: 1,
		lifecycleEmailsEnabled: false,
		manualGraceDays: 0,
		manualPaymentsEnabled: true,
		organizationsEnabled: true,
		paidSubscriptionsEnabled: false,
		signupGrantCredits: 700,
		signupGrantEnabled: false,
		starterPassRequired: false,
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

function request(
	overrides: Partial<ManualSubscriptionRequestRow> = {},
): ManualSubscriptionRequestRow {
	return {
		adminNotes: "Called once",
		amountUsdCents: 2500,
		city: "Algiers",
		company: null,
		country: "DZ",
		createdAt: NOW,
		fullName: "Owner",
		handledAt: null,
		handledByUserId: null,
		id: REQUEST_ID,
		interval: null,
		notes: null,
		organizationId: null,
		phone: "+213555000000",
		plan: null,
		preferredPaymentMethod: "bank_transfer",
		status: "pending",
		subscriptionId: null,
		tierCredits: null,
		updatedAt: NOW,
		userId: USER.id,
		...overrides,
	};
}

// 6750 DZD in centimes: 25 USD at 270.00 DZD per USD.
function recordInput(
	overrides: Partial<AdminRecordTopupInput> = {},
): AdminRecordTopupInput {
	return {
		amountMinor: 675_000,
		currency: "dzd",
		idempotencyKey: IDEMPOTENCY_KEY,
		method: "bank_transfer",
		reference: "CCP-42",
		userId: USER.id,
		...overrides,
	};
}

function receiptRow(
	overrides: Partial<BillingTopupReceiptRow> = {},
): BillingTopupReceiptRow {
	return {
		amountCents: 675_000,
		amountUsdCents: 2500,
		chargeId: null,
		createdAt: NOW,
		credits: 25_000,
		currency: "dzd",
		id: "receipt_1",
		method: "bank_transfer",
		note: null,
		organizationId: null,
		packId: null,
		paidAt: NOW,
		paymentIntentId: null,
		provider: "offline",
		providerReference: `offline:${IDEMPOTENCY_KEY}`,
		recordedByUserId: ADMIN_ID,
		reference: null,
		requestId: null,
		reversedAt: null,
		reversedByUserId: null,
		userId: USER.id,
		...overrides,
	};
}

/** In-memory credit ledger with the replay rule of CreditsService: a reused key must carry the same owner and amount. */
class FakeLedger {
	rows: CreditLedgerRow[] = [];

	async topup(
		owner: CreditOwner,
		amount: number,
		options: { idempotencyKey?: string } = {},
	): Promise<CreditLedgerRow> {
		return this.write(owner, amount, "topup", options.idempotencyKey);
	}

	async revoke(
		owner: CreditOwner,
		amount: number,
		options: { idempotencyKey?: string } = {},
	): Promise<CreditLedgerRow> {
		return this.write(owner, -amount, "revoke", options.idempotencyKey);
	}

	private write(
		owner: CreditOwner,
		delta: number,
		kind: CreditLedgerRow["kind"],
		idempotencyKey: string | undefined,
	): CreditLedgerRow {
		const ownerColumns =
			owner.type === "user"
				? { organizationId: null, userId: owner.userId }
				: { organizationId: owner.organizationId, userId: null };
		const existing = this.rows.find(
			(row) => row.idempotencyKey === idempotencyKey,
		);

		if (existing) {
			if (
				existing.delta !== delta ||
				existing.userId !== ownerColumns.userId ||
				existing.organizationId !== ownerColumns.organizationId
			) {
				throw new Error("Idempotency key replayed with other values");
			}

			return existing;
		}

		const row = {
			bucket: "topup",
			createdAt: NOW,
			delta,
			id: `ledger_${this.rows.length + 1}`,
			idempotencyKey: idempotencyKey ?? null,
			kind,
			meta: null,
			...ownerColumns,
		} satisfies CreditLedgerRow;

		this.rows.push(row);

		return row;
	}
}

function createContext(
	options: {
		billingOwner?: ManualBillingOwnerRow | null;
		receipts?: BillingTopupReceiptRow[];
		requests?: ManualSubscriptionRequestRow[];
	} = {},
) {
	const requests = new Map(
		(options.requests ?? [request()]).map((row) => [row.id, row]),
	);
	const receipts = new Map(
		(options.receipts ?? []).map((row) => [row.id, row]),
	);
	const ledger = new FakeLedger();
	// A case can change the DZD rate between two calls, like an admin does.
	const settings = productSettings();
	const lockedOwners: CreditOwner[] = [];
	const ownerLock = {
		withOwnerLock: async <T>(
			owner: CreditOwner,
			fn: (tx: SubscriptionCreditsTransaction) => Promise<T>,
		): Promise<T> => {
			lockedOwners.push(owner);
			// A thrown error rolls the transaction back, like Postgres does.
			const requestSnapshot = new Map(requests);
			const receiptSnapshot = new Map(receipts);
			const ledgerSnapshot = [...ledger.rows];

			try {
				return await fn(TRANSACTION);
			} catch (error) {
				requests.clear();
				for (const [id, row] of requestSnapshot) {
					requests.set(id, row);
				}
				receipts.clear();
				for (const [id, row] of receiptSnapshot) {
					receipts.set(id, row);
				}
				ledger.rows = ledgerSnapshot;

				throw error;
			}
		},
	};
	const updateRequest = async (
		id: string,
		input: UpdateManualSubscriptionRequestInput,
	): Promise<ManualSubscriptionRequestRow | null> => {
		const current = requests.get(id);

		if (!current) {
			return null;
		}

		const updated = { ...current, ...input, updatedAt: NOW };
		requests.set(id, updated);

		return updated;
	};
	const requestsRepository = {
		countOpen: async () => 0,
		findAdminById: vi.fn(
			async (id: string): Promise<AdminManualRequestRow | null> => {
				const row = requests.get(id);

				return row
					? {
							currentSubscription: null,
							handledBy: null,
							organization: null,
							request: row,
							user: USER,
						}
					: null;
			},
		),
		findById: async (id: string) => requests.get(id) ?? null,
		findBySubscriptionId: async () => null,
		findOpenByOwner: async () =>
			[...requests.values()].find((row) =>
				OPEN_MANUAL_REQUEST_STATUSES.some((status) => status === row.status),
			) ?? null,
		listForAdmin: async () => ({ items: [], page: 1, pageSize: 20, total: 0 }),
		update: vi.fn(updateRequest),
		updateIfNotTerminal: vi.fn(
			async (id: string, input: UpdateManualSubscriptionRequestInput) => {
				const current = requests.get(id);

				if (
					!current ||
					current.status === "approved" ||
					current.status === "canceled"
				) {
					return null;
				}

				return updateRequest(id, input);
			},
		),
	};
	const findReceipt = async (id: string) => receipts.get(id) ?? null;
	const receiptsRepository = {
		findAdminById: async (id: string): Promise<AdminTopupReceiptRow | null> => {
			const receipt = receipts.get(id);

			return receipt
				? {
						organization: null,
						receipt,
						recordedBy: null,
						reversedBy: null,
						user: USER,
					}
				: null;
		},
		findById: findReceipt,
		findByProviderReference: async (providerReference: string) =>
			[...receipts.values()].find(
				(row) => row.providerReference === providerReference,
			) ?? null,
		insertIfAbsent: async (input: InsertBillingTopupReceipt) => {
			if (
				[...receipts.values()].some(
					(row) => row.providerReference === input.providerReference,
				)
			) {
				return null;
			}

			const row = receiptRow({ ...input, id: `receipt_${receipts.size + 1}` });
			receipts.set(row.id, row);

			return row;
		},
		listForAdmin: async () => ({ items: [], page: 1, pageSize: 20, total: 0 }),
		markReversed: async (
			id: string,
			reversedByUserId: string,
			reversedAt: Date,
		) => {
			const row = receipts.get(id);

			if (!row || row.reversedAt !== null) {
				return null;
			}

			const reversed = { ...row, reversedAt, reversedByUserId };
			receipts.set(id, reversed);

			return reversed;
		},
	};
	// The pass writes of the service. The repository decides between a move and a revoke in SQL.
	const passGrants: Array<{ owner: CreditOwner; grant: StarterPassGrant }> = [];
	const passRevokes: Array<{ reason: string; receiptId: string }> = [];
	const starterPasses = {
		grantIfAbsent: async (owner: CreditOwner, grant: StarterPassGrant) => {
			passGrants.push({ grant, owner });

			return null;
		},
		revokeOrMoveForReceipt: async (
			receipt: Pick<BillingTopupReceiptRow, "id">,
			reason: string,
		) => {
			passRevokes.push({ reason, receiptId: receipt.id });

			return null;
		},
	};
	const service = new ManualSubscriptionsService(
		{
			countManualActive: async () => 0,
			countManualExpiringBetween: async () => 0,
			findManualAdminById: async () => null,
			findManualBillingOwner: async () =>
				options.billingOwner === undefined
					? { organization: null, user: USER }
					: options.billingOwner,
			listManualForAdmin: async () => ({
				items: [],
				page: 1,
				pageSize: 20,
				total: 0,
			}),
		},
		ownerLock,
		ledger,
		{
			listBySubscription: async () => [],
			sumByCurrencyBetween: async () => [],
		},
		requestsRepository,
		receiptsRepository,
		{ get: async () => settings },
		{ enqueue: async () => null },
		starterPasses,
	);

	return {
		ledger,
		lockedOwners,
		passGrants,
		passRevokes,
		receipts,
		requests,
		requestsRepository,
		service,
		settings,
	};
}

describe("ManualSubscriptionsService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("recordTopup", () => {
		it("grants once, approves the open request, and returns the first receipt on a replay", async () => {
			const context = createContext();

			const first = await context.service.recordTopup(ADMIN_ID, recordInput());
			// The request is approved now. A replay must still return the receipt, not "no longer open".
			const replay = await context.service.recordTopup(ADMIN_ID, recordInput());

			expect(replay).toEqual(first);
			expect(first).toMatchObject({
				amountMinor: 675_000,
				amountUsdCents: 2500,
				credits: 250,
				currency: "dzd",
				provider: "offline",
				providerReference: `offline:${IDEMPOTENCY_KEY}`,
				requestId: REQUEST_ID,
			});
			expect(context.ledger.rows).toEqual([
				expect.objectContaining({
					delta: 25_000,
					idempotencyKey: `offline-topup:${IDEMPOTENCY_KEY}`,
					userId: USER.id,
				}),
			]);
			expect(context.receipts.size).toBe(1);
			expect(context.requests.get(REQUEST_ID)).toMatchObject({
				handledByUserId: ADMIN_ID,
				status: "approved",
			});
			// Cash an admin recorded unlocks the pool once. The replay returns before any write.
			expect(context.passGrants).toEqual([
				{
					grant: { receiptId: first.id, source: "offline" },
					owner: { type: "user", userId: USER.id },
				},
			]);
		});

		it("returns the first receipt on a replay after an admin changes the DZD rate", async () => {
			const context = createContext();
			const first = await context.service.recordTopup(ADMIN_ID, recordInput());
			context.settings.dzdPerUsdRate = 30_000;

			await expect(
				context.service.recordTopup(ADMIN_ID, recordInput()),
			).resolves.toEqual(first);
			expect(context.ledger.rows).toHaveLength(1);
		});

		it.each([
			["other credits", recordInput({ credits: 300 })],
			["another user", recordInput({ requestId: undefined, userId: "user_2" })],
		])("answers 409, not 500, for a replayed key with %s", async (_label, replayInput) => {
			const context = createContext();
			await context.service.recordTopup(ADMIN_ID, recordInput());

			await expect(
				context.service.recordTopup(ADMIN_ID, replayInput),
			).rejects.toBeInstanceOf(ConflictException);
			expect(context.ledger.rows).toHaveLength(1);
			expect(context.receipts.size).toBe(1);
		});

		it("refuses the organization of a personal workspace before it takes the lock", async () => {
			const context = createContext({
				billingOwner: {
					organization: {
						id: "org_personal",
						name: "Owner's workspace",
						personalOwnerUserId: USER.id,
						slug: "owner",
					},
					user: USER,
				},
			});

			await expect(
				context.service.recordTopup(
					ADMIN_ID,
					recordInput({ organizationId: "org_personal" }),
				),
			).rejects.toBeInstanceOf(BadRequestException);
			expect(context.lockedOwners).toEqual([]);
			expect(context.ledger.rows).toHaveLength(0);
		});

		it("refuses a request that is no longer open and writes nothing", async () => {
			const context = createContext({
				requests: [request({ status: "rejected" })],
			});

			await expect(
				context.service.recordTopup(
					ADMIN_ID,
					recordInput({ requestId: REQUEST_ID }),
				),
			).rejects.toBeInstanceOf(ConflictException);
			expect(context.ledger.rows).toHaveLength(0);
			expect(context.receipts.size).toBe(0);
		});
	});

	describe("offlineTopupAmounts", () => {
		// 27000 is 270.00 DZD per USD. Default credits: 10 per whole USD.
		it.each([
			["2500 USD cents", { amountMinor: 2500, currency: "usd" }, 2500, 25_000],
			["6750 DZD", { amountMinor: 675_000, currency: "dzd" }, 2500, 25_000],
			[
				"6800 DZD (25.19 USD, whole USD only)",
				{ amountMinor: 680_000, currency: "dzd" },
				2519,
				25_000,
			],
			[
				"an explicit 12.5 credits for 300 EUR",
				{ amountMinor: 30_000, credits: 12.5, currency: "eur" },
				null,
				1250,
			],
		])("%s", (_label, input, expectedUsdCents, expectedCentiCredits) => {
			expect(offlineTopupAmounts(input, 27_000)).toEqual({
				amountUsdCents: expectedUsdCents,
				centiCredits: expectedCentiCredits,
			});
		});

		it.each([
			["EUR with no credits", { amountMinor: 30_000, currency: "eur" }],
			["99 USD cents", { amountMinor: 99, currency: "usd" }],
		])("answers 400 for %s", (_label, input) => {
			expect(() => offlineTopupAmounts(input, 27_000)).toThrow(
				BadRequestException,
			);
		});
	});

	describe("reverseTopup", () => {
		it("revokes the receipt credits once and returns the same receipt on a second call", async () => {
			const context = createContext({ receipts: [receiptRow()] });

			const first = await context.service.reverseTopup(ADMIN_ID, {
				receiptId: "receipt_1",
			});
			const second = await context.service.reverseTopup("admin_2", {
				receiptId: "receipt_1",
			});

			expect(second).toEqual(first);
			expect(first.reversedAt).toBe(NOW.toISOString());
			expect(context.ledger.rows).toEqual([
				expect.objectContaining({
					delta: -25_000,
					idempotencyKey: "topup-reverse:receipt_1",
					kind: "revoke",
				}),
			]);
			expect(context.receipts.get("receipt_1")?.reversedByUserId).toBe(
				ADMIN_ID,
			);
			// The second call returns before the writes, so the pass of the receipt is taken once.
			expect(context.passRevokes).toEqual([
				{ reason: "receipt_reversed:receipt_1", receiptId: "receipt_1" },
			]);
		});

		it("refuses a Stripe receipt, which a refund webhook reverses", async () => {
			const context = createContext({
				receipts: [receiptRow({ provider: "stripe" })],
			});

			await expect(
				context.service.reverseTopup(ADMIN_ID, { receiptId: "receipt_1" }),
			).rejects.toBeInstanceOf(BadRequestException);
			expect(context.ledger.rows).toHaveLength(0);
		});
	});

	describe("updateRequest", () => {
		it("cancels an open request with the admin and reason", async () => {
			const context = createContext();
			const adminNotes = "The customer canceled the order.";

			await context.service.updateRequest(ADMIN_ID, REQUEST_ID, {
				adminNotes,
				status: "canceled",
			});

			expect(
				context.requestsRepository.updateIfNotTerminal,
			).toHaveBeenCalledWith(REQUEST_ID, {
				adminNotes,
				handledAt: NOW,
				handledByUserId: ADMIN_ID,
				status: "canceled",
			});
			expect(context.requests.get(REQUEST_ID)?.status).toBe("canceled");
		});

		it("refuses a call back status on an already canceled request before any update", async () => {
			const context = createContext({
				requests: [request({ status: "canceled" })],
			});

			await expect(
				context.service.updateRequest(ADMIN_ID, REQUEST_ID, {
					status: "call_back",
				}),
			).rejects.toBeInstanceOf(ConflictException);
			expect(
				context.requestsRepository.updateIfNotTerminal,
			).not.toHaveBeenCalled();
			expect(context.requestsRepository.update).not.toHaveBeenCalled();
		});

		it("does not reopen a request that becomes terminal during an admin update", async () => {
			const context = createContext();
			context.requestsRepository.updateIfNotTerminal.mockImplementationOnce(
				async () => {
					context.requests.set(REQUEST_ID, request({ status: "canceled" }));

					return null;
				},
			);

			await expect(
				context.service.updateRequest(ADMIN_ID, REQUEST_ID, {
					status: "contacted",
				}),
			).rejects.toBeInstanceOf(ConflictException);
			expect(context.requests.get(REQUEST_ID)?.status).toBe("canceled");
		});
	});
});
