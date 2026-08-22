import { parsePriceLookupKey, priceUsdFor } from "@wandit/contracts";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	userOwner,
} from "../../../credits/domain/credit-owner";
import type {
	CreditLedgerRow,
	CreditsRepository,
	CreditsTransaction,
	InsertCreditLedgerEntry,
} from "../../../credits/infrastructure/persistence/credits.repository";
import type { BillingCheckoutAttemptsRepository } from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import type { BillingCustomersRepository } from "../../infrastructure/persistence/billing-customers.repository";
import {
	canceledSlotValues,
	type InsertInvoiceApplication,
	type InsertRefillSlot,
	type InvoiceApplicationRow,
	type RefillSlotCancellation,
	type RefillSlotRow,
	type SubscriptionCreditRow,
	type SubscriptionCreditsRepository,
	type SubscriptionCreditsTransaction,
} from "../../infrastructure/persistence/subscription-credits.repository";
import type { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";
import type { StripeProvider } from "../../infrastructure/stripe/stripe.provider";
import type { PaymentRefundsService } from "./payment-refunds.service";
import { SubscriptionCreditsService } from "./subscription-credits.service";
import { SubscriptionRefillService } from "./subscription-refill.service";

const USER_ID = "user_1";
const OWNER = userOwner(USER_ID);
const PERIOD_START = new Date("2026-01-31T12:00:00.000Z");
const PERIOD_END = new Date("2027-01-31T12:00:00.000Z");

class MemoryCreditsRepository {
	rows: CreditLedgerRow[] = [];
	failGrantKeyOnce: string | null = null;
	failAfterCallbackOnce = false;
	readonly insertAttempts: string[] = [];
	private nextId = 1;
	private readonly tx = {} as CreditsTransaction;

	async withOwnerLock<T>(
		_owner: CreditOwner,
		fn: (tx: CreditsTransaction) => Promise<T>,
		transaction?: CreditsTransaction,
	): Promise<T> {
		if (transaction) {
			return fn(transaction);
		}

		const snapshot = [...this.rows];

		try {
			const result = await fn(this.tx);

			if (this.failAfterCallbackOnce) {
				this.failAfterCallbackOnce = false;
				throw new Error("simulated crash before transaction commit");
			}

			return result;
		} catch (error) {
			this.rows = snapshot;
			throw error;
		}
	}

	async withLockValue<T>(
		_lockValue: string,
		fn: (tx: CreditsTransaction) => Promise<T>,
		transaction?: CreditsTransaction,
	): Promise<T> {
		if (transaction) {
			return fn(transaction);
		}

		return fn(this.tx);
	}

	async getBalance(owner: CreditOwner) {
		const result = { balance: 0, plan: 0, promo: 0, topup: 0 };

		for (const row of this.rows.filter((entry) =>
			this.ownerMatches(entry, owner),
		)) {
			result[row.bucket] += row.delta;
		}
		result.balance = result.plan + result.promo + result.topup;

		return result;
	}

	async findByIdempotencyKey(key: string) {
		return this.rows.find((row) => row.idempotencyKey === key) ?? null;
	}

	async findByIdempotencyKeys(owner: CreditOwner, keys: string[]) {
		return this.rows.filter(
			(row) =>
				this.ownerMatches(row, owner) &&
				row.idempotencyKey !== null &&
				keys.includes(row.idempotencyKey),
		);
	}

	private ownerMatches(row: CreditLedgerRow, owner: CreditOwner): boolean {
		return owner.type === "user"
			? row.userId === owner.userId && row.organizationId === null
			: row.organizationId === owner.organizationId;
	}

	async listRefundablePlanHolds() {
		return [];
	}

	async findPlanHoldPools() {
		return [];
	}

	async applyPlanHoldBoundary() {}

	async closePlanHoldPools() {}

	async forfeitAllPlanHolds() {}

	async insertLedgerEntry(input: InsertCreditLedgerEntry) {
		if (input.idempotencyKey) {
			this.insertAttempts.push(input.idempotencyKey);
		}

		if (
			input.kind === "grant" &&
			input.idempotencyKey === this.failGrantKeyOnce
		) {
			this.failGrantKeyOnce = null;
			throw new Error("simulated crash before refill grant");
		}

		if (input.idempotencyKey) {
			const existing = await this.findByIdempotencyKey(input.idempotencyKey);

			if (existing) {
				return existing;
			}
		}

		const row = {
			bucket: input.bucket,
			createdAt: new Date(this.nextId * 1000),
			delta: input.delta,
			id: `ledger_${this.nextId++}`,
			idempotencyKey: input.idempotencyKey ?? null,
			kind: input.kind,
			meta: input.meta,
			organizationId: input.organizationId ?? null,
			userId: input.userId,
		} satisfies CreditLedgerRow;
		this.rows.push(row);

		return row;
	}

	seedPlan(amount: number): void {
		void this.insertLedgerEntry({
			bucket: "plan",
			delta: amount,
			kind: "grant",
			meta: { reason: "seed" },
			userId: USER_ID,
		});
	}
}

class MemorySubscriptionCreditsRepository {
	applications: InvoiceApplicationRow[] = [];
	canonical: SubscriptionCreditRow | null;
	slots: RefillSlotRow[] = [];
	readonly subscriptions = new Map<string, SubscriptionCreditRow>();
	private nextSlotId = 1;
	private lock: Promise<void> = Promise.resolve();
	private readonly tx = {} as SubscriptionCreditsTransaction;

	constructor(
		canonical: SubscriptionCreditRow,
		private readonly credits: MemoryCreditsRepository,
	) {
		this.canonical = canonical;
		this.subscriptions.set(canonical.id, canonical);
	}

	async withOwnerLock<T>(
		_owner: CreditOwner,
		fn: (tx: SubscriptionCreditsTransaction) => Promise<T>,
	): Promise<T> {
		const previous = this.lock;
		let release!: () => void;
		this.lock = new Promise((resolve) => {
			release = resolve;
		});
		await previous;
		const slots = structuredClone(this.slots);
		const applications = structuredClone(this.applications);
		const ledger = structuredClone(this.credits.rows);

		try {
			return await fn(this.tx);
		} catch (error) {
			this.slots = slots;
			this.applications = applications;
			this.credits.rows = ledger;
			throw error;
		} finally {
			release();
		}
	}

	async findCanonicalEntitledByOwner() {
		return this.canonical;
	}

	async findSubscriptionByProviderId(providerId: string) {
		return (
			[...this.subscriptions.values()].find(
				(row) => row.providerSubscriptionId === providerId,
			) ?? null
		);
	}

	async findInvoiceApplication(invoiceId: string) {
		return (
			this.applications.find((row) => row.stripeInvoiceId === invoiceId) ?? null
		);
	}

	async hasGrossGrant(owner: CreditOwner, idempotencyKey: string) {
		return this.credits.rows.some(
			(row) =>
				(owner.type === "user"
					? row.userId === owner.userId && row.organizationId === null
					: row.organizationId === owner.organizationId) &&
				row.idempotencyKey === idempotencyKey &&
				row.kind === "grant" &&
				row.delta > 0,
		);
	}

	async findLatestInvoiceApplication(subscriptionId: string) {
		return (
			[...this.applications]
				.reverse()
				.find((row) => row.subscriptionId === subscriptionId) ?? null
		);
	}

	seedApplication(newPriceLookupKey: string): void {
		this.applications.push({
			amountPaidMinor: null,
			appliedAt: new Date(this.applications.length),
			billingReason: "subscription_cycle",
			creditsDelta: 0,
			currency: null,
			newPriceLookupKey,
			oldPriceLookupKey: null,
			paidAt: null,
			periodEnd: PERIOD_END,
			periodStart: PERIOD_START,
			stripeInvoiceId: `seed_${this.applications.length}`,
			subscriptionId: this.canonical?.id ?? "sub_local",
		});
	}

	async findCycleAtOrAfter(subscriptionId: string, periodEnd: Date) {
		return (
			this.applications.find(
				(row) =>
					row.subscriptionId === subscriptionId &&
					row.billingReason === "subscription_cycle" &&
					row.periodEnd >= periodEnd,
			) ?? null
		);
	}

	async insertInvoiceApplication(input: InsertInvoiceApplication) {
		const existing = await this.findInvoiceApplication(input.stripeInvoiceId);

		if (existing) {
			return existing;
		}

		const row = {
			...input,
			appliedAt: new Date(),
			oldPriceLookupKey: input.oldPriceLookupKey ?? null,
		} as InvoiceApplicationRow;
		this.applications.push(row);

		return row;
	}

	async insertRefillSlots(inputs: InsertRefillSlot[]) {
		const inserted: RefillSlotRow[] = [];

		for (const input of inputs) {
			const duplicate = this.slots.find(
				(slot) =>
					slot.subscriptionId === input.subscriptionId &&
					slot.fundingInvoiceId === input.fundingInvoiceId &&
					slot.periodOrdinal === input.periodOrdinal,
			);

			if (duplicate) {
				continue;
			}

			const row = {
				...input,
				canceledAt: null,
				canceledReason: null,
				fundingChargeId: input.fundingChargeId ?? null,
				fundingPaymentIntentId: input.fundingPaymentIntentId ?? null,
				grantedAt: null,
				id: `slot_${this.nextSlotId++}`,
				status: input.status ?? "pending",
				supersededByInvoiceId: null,
			} as RefillSlotRow;
			this.slots.push(row);
			inserted.push(row);
		}

		return inserted;
	}

	async cancelPendingSlotsForSubscription(
		subscriptionId: string,
		provenance: RefillSlotCancellation,
	) {
		let count = 0;

		for (const slot of this.slots) {
			if (slot.subscriptionId === subscriptionId && slot.status === "pending") {
				Object.assign(slot, canceledSlotValues(provenance));
				count += 1;
			}
		}

		return count;
	}

	async cancelPendingSlotsByFunding(input: {
		chargeId?: string | null;
		invoiceId?: string | null;
		paymentIntentId?: string | null;
	}) {
		let count = 0;

		for (const slot of this.slots) {
			if (
				slot.status === "pending" &&
				((input.chargeId && slot.fundingChargeId === input.chargeId) ||
					(input.invoiceId && slot.fundingInvoiceId === input.invoiceId) ||
					(input.paymentIntentId &&
						slot.fundingPaymentIntentId === input.paymentIntentId))
			) {
				slot.status = "canceled";
				count += 1;
			}
		}

		return count;
	}

	async listDueSlotIds(now: Date, limit: number) {
		return this.slots
			.filter((slot) => slot.status === "pending" && slot.dueAt <= now)
			.sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime())
			.slice(0, limit)
			.map((slot) => slot.id);
	}

	async findDuePendingSlotsForSubscription(
		subscriptionId: string,
		dueThrough: Date,
	) {
		return this.slots
			.filter(
				(slot) =>
					slot.subscriptionId === subscriptionId &&
					slot.status === "pending" &&
					slot.dueAt <= dueThrough,
			)
			.sort((left, right) => {
				const dueDifference = left.dueAt.getTime() - right.dueAt.getTime();

				return dueDifference !== 0
					? dueDifference
					: left.periodOrdinal - right.periodOrdinal;
			});
	}

	async findSlotWithSubscription(slotId: string) {
		const slot = this.slots.find((row) => row.id === slotId);
		const subscription = slot
			? this.subscriptions.get(slot.subscriptionId)
			: null;

		return slot && subscription ? { slot, subscription } : null;
	}

	async claimDueSlot(slotId: string, now: Date) {
		const slot = this.slots.find((row) => row.id === slotId);

		if (slot?.status !== "pending" || slot.dueAt > now) {
			return null;
		}

		slot.status = "granted";
		slot.grantedAt = now;

		return slot;
	}

	async cancelPendingSlot(slotId: string, provenance: RefillSlotCancellation) {
		const slot = this.slots.find((row) => row.id === slotId);

		if (slot?.status !== "pending") {
			return false;
		}

		Object.assign(slot, canceledSlotValues(provenance));

		return true;
	}
}

function subscription(
	overrides: Partial<SubscriptionCreditRow> = {},
): SubscriptionCreditRow {
	return {
		cancelAtPeriodEnd: false,
		createdAt: new Date(0),
		currentPeriodEnd: PERIOD_END,
		currentPeriodStart: PERIOD_START,
		id: "sub_local",
		interval: "month",
		organizationId: null,
		pendingAppliedBy: null,
		pendingTierCredits: null,
		plan: "pro",
		priceLookupKey: "pro_250_month",
		provider: "stripe",
		providerSubscriptionId: "sub_remote",
		status: "active",
		tierCredits: 250,
		updatedAt: new Date(0),
		userId: USER_ID,
		...overrides,
	};
}

function catalogPriceMinor(lookupKey: string): number {
	const parsed = parsePriceLookupKey(lookupKey);

	if (!parsed) {
		throw new Error(`Unknown fixture lookup key ${lookupKey}`);
	}

	return Math.round(
		priceUsdFor(parsed.plan, parsed.tierCredits, parsed.interval) * 100,
	);
}

function invoice(input: {
	amountPaid?: number;
	anchorReset?: boolean;
	currency?: string;
	customerBalance?: { ending: number; starting: number };
	fundingChargeId?: string;
	id: string;
	newKey: string;
	total?: number;
	oldKey?: string;
	reason: "subscription_create" | "subscription_cycle" | "subscription_update";
	paidAt?: Date;
	periodEnd?: Date;
	periodStart?: Date;
}): Stripe.Invoice {
	const start = input.periodStart ?? PERIOD_START;
	const end = input.periodEnd ?? PERIOD_END;
	const line = (lookupKey: string, amount: number, proration: boolean) => ({
		amount,
		parent: {
			subscription_item_details: { proration },
			type: "subscription_item_details",
		},
		period: {
			end: Math.floor(end.getTime() / 1000),
			start: Math.floor(start.getTime() / 1000),
		},
		pricing: {
			price_details: {
				price: { id: `price_${lookupKey}`, lookup_key: lookupKey },
			},
		},
	});
	const fullPriceMinor = catalogPriceMinor(input.newKey);
	// Anchor-reset upgrades and month->year changes carry the new plan as a
	// full-period line at the full catalog price; delta-priced updates carry
	// proration lines only.
	const lines =
		input.oldKey && !input.anchorReset
			? [line(input.oldKey, -1000, true), line(input.newKey, 1000, true)]
			: [line(input.newKey, fullPriceMinor, false)];

	if (input.oldKey && input.anchorReset) {
		lines.push(line(input.oldKey, -1000, true));
	}
	const paymentIntentId = input.fundingChargeId
		? `pi_${input.fundingChargeId}`
		: null;
	const amountPaid =
		input.amountPaid ??
		(input.fundingChargeId
			? input.oldKey && !input.anchorReset
				? 1000
				: fullPriceMinor
			: 0);

	return {
		amount_paid: amountPaid,
		billing_reason: input.reason,
		...(input.customerBalance
			? {
					ending_balance: input.customerBalance.ending,
					starting_balance: input.customerBalance.starting,
				}
			: {}),
		...(input.total !== undefined ? { total: input.total } : {}),
		created: Math.floor((input.paidAt ?? start).getTime() / 1000),
		currency: input.currency ?? "usd",
		customer: "cus_1",
		id: input.id,
		lines: { data: lines },
		parent: {
			subscription_details: {
				metadata: { userId: USER_ID },
				subscription: "sub_remote",
			},
			type: "subscription_details",
		},
		payments: {
			data: input.fundingChargeId
				? [
						{
							payment: {
								charge: {
									id: input.fundingChargeId,
									payment_intent: paymentIntentId,
								},
								type: "charge",
							},
							status: "paid",
						},
					]
				: [],
		},
		status_transitions: {
			paid_at: Math.floor((input.paidAt ?? start).getTime() / 1000),
		},
	} as unknown as Stripe.Invoice;
}

function setup(initial = subscription()) {
	const creditRepository = new MemoryCreditsRepository();
	const credits = new CreditsService(
		creditRepository as unknown as CreditsRepository,
	);
	const repository = new MemorySubscriptionCreditsRepository(
		initial,
		creditRepository,
	);
	const invoices = new Map<string, Stripe.Invoice>();
	const paymentRefunds = {
		reconcileChargeAfterGrant: vi.fn(async () => undefined),
	};
	const outboxRows: Array<{ chargeId: string; triggerRef: string }> = [];
	const reconciliationOutbox = {
		enqueue: vi.fn(async (input: { chargeId: string; triggerRef: string }) => {
			if (
				outboxRows.some(
					(row) =>
						row.chargeId === input.chargeId &&
						row.triggerRef === input.triggerRef,
				)
			) {
				return null;
			}

			outboxRows.push(input);

			return input;
		}),
		markDoneForCharge: vi.fn(async () => 0),
	};
	const receipts = { insertIfAbsent: vi.fn(async () => null) };
	const refill = new SubscriptionRefillService(
		repository as unknown as SubscriptionCreditsRepository,
		credits,
		paymentRefunds as unknown as PaymentRefundsService,
		reconciliationOutbox as never,
	);
	const subscriptionsRepository = {
		clearAppliedPendingTier: vi.fn(async () => initial),
		findByProviderSubscriptionId: vi.fn(async (providerId: string) =>
			providerId === initial.providerSubscriptionId ? initial : null,
		),
	};
	const stripe = {
		listInvoicePayments: vi.fn(async () => [] as Stripe.InvoicePayment[]),
		lookupKeyForPriceId: vi.fn(async () => null),
		retrieveInvoice: vi.fn(async (id: string) => {
			const found = invoices.get(id);

			if (!found) {
				throw new Error(`Missing fake invoice ${id}`);
			}

			return found;
		}),
		retrievePaymentIntent: vi.fn(),
		retrieveSubscription: vi.fn(),
	};
	const service = new SubscriptionCreditsService(
		{
			findByProviderCustomerId: vi.fn(async () => ({ userId: USER_ID })),
		} as unknown as BillingCustomersRepository,
		subscriptionsRepository as unknown as SubscriptionsRepository,
		credits,
		stripe as unknown as StripeProvider,
		paymentRefunds as unknown as PaymentRefundsService,
		repository as unknown as SubscriptionCreditsRepository,
		refill,
		{} as BillingCheckoutAttemptsRepository,
		{ findByProviderCustomerId: async () => null } as never,
		reconciliationOutbox as never,
		receipts as never,
	);

	return {
		creditRepository,
		credits,
		invoices,
		outboxRows,
		paymentRefunds,
		receipts,
		reconciliationOutbox,
		refill,
		repository,
		service,
		stripe,
		subscriptionsRepository,
	};
}

function addInvoice(
	context: ReturnType<typeof setup>,
	value: Stripe.Invoice,
): void {
	context.invoices.set(value.id, value);
}

describe("Subscription credit policy", () => {
	it("applies capped refill math below and above the rollover cap", async () => {
		const below = setup();
		below.creditRepository.seedPlan(60);
		const belowResult = await below.credits.applyCappedRefill(OWNER, 100, {
			idempotencyKey: "refill:below",
		});
		expect(belowResult).toMatchObject({
			carriedCredits: 60,
			expiredCredits: 0,
			preRefillPlanBalance: 60,
		});
		expect((await below.credits.getBalance(OWNER)).plan).toBe(160);

		const above = setup();
		above.creditRepository.seedPlan(150);
		const aboveResult = await above.credits.applyCappedRefill(OWNER, 100, {
			idempotencyKey: "refill:above",
		});
		expect(aboveResult).toMatchObject({
			carriedCredits: 100,
			expiredCredits: 50,
			preRefillPlanBalance: 150,
		});
		expect((await above.credits.getBalance(OWNER)).plan).toBe(200);
	});

	it("rolls back a crash between expiration and grant, then replays once", async () => {
		const context = setup();
		context.creditRepository.seedPlan(150);
		context.creditRepository.failGrantKeyOnce = "refill:crash";

		await expect(
			context.credits.applyCappedRefill(OWNER, 100, {
				idempotencyKey: "refill:crash",
			}),
		).rejects.toThrow("simulated crash");
		expect(context.creditRepository.rows).toHaveLength(1);

		await context.credits.applyCappedRefill(OWNER, 100, {
			idempotencyKey: "refill:crash",
		});
		const rowCount = context.creditRepository.rows.length;
		const replay = await context.credits.applyCappedRefill(OWNER, 100, {
			idempotencyKey: "refill:crash",
		});
		expect(replay.replayed).toBe(true);
		expect(context.creditRepository.rows).toHaveLength(rowCount);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(200);
	});

	it("rolls back both executed writes when commit crashes, then replays exactly once", async () => {
		const context = setup();
		context.creditRepository.seedPlan(150);
		context.creditRepository.failAfterCallbackOnce = true;

		await expect(
			context.credits.applyCappedRefill(OWNER, 100, {
				idempotencyKey: "refill:atomic",
			}),
		).rejects.toThrow("simulated crash before transaction commit");
		expect(context.creditRepository.insertAttempts).toEqual(
			expect.arrayContaining(["refill:atomic:expire", "refill:atomic"]),
		);
		expect(context.creditRepository.rows).toHaveLength(1);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(150);

		await context.credits.applyCappedRefill(OWNER, 100, {
			idempotencyKey: "refill:atomic",
		});
		const replay = await context.credits.applyCappedRefill(OWNER, 100, {
			idempotencyKey: "refill:atomic",
		});
		expect(replay.replayed).toBe(true);
		expect(
			context.creditRepository.rows.filter(
				(row) => row.idempotencyKey === "refill:atomic",
			),
		).toHaveLength(1);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(200);
	});

	it("grants only month one for a yearly create and creates eleven funded slots", async () => {
		const context = setup(
			subscription({
				interval: "year",
				priceLookupKey: "pro_250_year",
			}),
		);
		const value = invoice({
			id: "in_year_create",
			newKey: "pro_250_year",
			reason: "subscription_create",
		});
		addInvoice(context, value);

		await context.service.grantForPaidInvoice(value);

		// 250-credit tier -> 25_000 centi-credits granted.
		expect((await context.credits.getBalance(OWNER)).plan).toBe(25_000);
		expect(context.repository.slots).toHaveLength(11);
		expect(context.repository.slots.map((slot) => slot.periodOrdinal)).toEqual([
			2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
		]);
		expect(context.repository.slots[0]?.dueAt.toISOString()).toBe(
			"2026-02-28T12:00:00.000Z",
		);
	});

	it("recovers funding references from the payments list when the retrieve lacks the payments expansion", async () => {
		const context = setup();
		const value = invoice({
			fundingChargeId: "ch_fallback",
			id: "in_no_payments_expand",
			newKey: "pro_250_month",
			reason: "subscription_create",
		});
		const stripped = value as unknown as {
			payments?: { data: Stripe.InvoicePayment[] };
		};
		const payments = stripped.payments?.data ?? [];
		stripped.payments = undefined;
		context.stripe.listInvoicePayments.mockResolvedValue(payments);
		addInvoice(context, value);

		await context.service.grantForPaidInvoice(value);

		expect(context.stripe.listInvoicePayments).toHaveBeenCalledWith(
			"in_no_payments_expand",
		);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(25_000);
		expect(
			context.paymentRefunds.reconcileChargeAfterGrant,
		).toHaveBeenCalledWith("ch_fallback");

		const application = context.repository.applications.find(
			(row) => row.stripeInvoiceId === "in_no_payments_expand",
		);
		expect(application?.amountPaidMinor).toBe(2500);
		expect(application?.currency).toBe("usd");
		expect(application?.paidAt?.toISOString()).toBe(PERIOD_START.toISOString());
	});

	it("handles monthly upgrades immediately and leaves downgrades for renewal", async () => {
		const upgrade = setup(
			subscription({ priceLookupKey: "pro_500_month", tierCredits: 500 }),
		);
		upgrade.repository.seedApplication("pro_250_month");
		upgrade.creditRepository.seedPlan(4_000);
		const upInvoice = invoice({
			id: "in_month_up",
			newKey: "pro_500_month",
			oldKey: "pro_250_month",
			reason: "subscription_update",
		});
		addInvoice(upgrade, upInvoice);
		await upgrade.service.grantForPaidInvoice(upInvoice);
		// 4_000 seeded + (500 - 250) * 100 upgrade delta.
		expect((await upgrade.credits.getBalance(OWNER)).plan).toBe(29_000);
		expect(upgrade.repository.slots).toHaveLength(0);

		const downgrade = setup(subscription({ priceLookupKey: "pro_250_month" }));
		downgrade.repository.seedApplication("pro_500_month");
		downgrade.creditRepository.seedPlan(36_000);
		const downInvoice = invoice({
			id: "in_month_down",
			newKey: "pro_250_month",
			oldKey: "pro_500_month",
			reason: "subscription_update",
		});
		addInvoice(downgrade, downInvoice);
		await downgrade.service.grantForPaidInvoice(downInvoice);
		expect((await downgrade.credits.getBalance(OWNER)).plan).toBe(36_000);
		expect(downgrade.repository.applications[0]?.creditsDelta).toBe(0);

		const renewal = invoice({
			id: "in_month_down_renewal",
			newKey: "pro_250_month",
			periodEnd: new Date("2027-02-28T12:00:00.000Z"),
			periodStart: PERIOD_END,
			reason: "subscription_cycle",
		});
		addInvoice(downgrade, renewal);
		await downgrade.service.grantForPaidInvoice(renewal);
		// Carried min(36_000, 25_000 cap) + 25_000 cycle allotment.
		expect((await downgrade.credits.getBalance(OWNER)).plan).toBe(50_000);
	});

	it("grants the full allotment with a capped refill for an anchor-reset same-interval upgrade", async () => {
		// Ruling 7: the full-price new-plan line plus the negative old-plan
		// proration marks an anchor reset; the preview promised a capped refill.
		const above = setup(
			subscription({ priceLookupKey: "pro_500_month", tierCredits: 500 }),
		);
		above.repository.seedApplication("pro_250_month");
		above.creditRepository.seedPlan(62_000);
		const aboveInvoice = invoice({
			anchorReset: true,
			fundingChargeId: "ch_anchor_up",
			id: "in_anchor_up",
			newKey: "pro_500_month",
			oldKey: "pro_250_month",
			reason: "subscription_update",
		});
		addInvoice(above, aboveInvoice);
		await above.service.grantForPaidInvoice(aboveInvoice);
		// min(62_000, 50_000 cap) + 50_000 allotment.
		expect((await above.credits.getBalance(OWNER)).plan).toBe(100_000);
		expect(
			above.repository.applications.find(
				(row) => row.stripeInvoiceId === "in_anchor_up",
			)?.creditsDelta,
		).toBe(38_000);
		expect(
			above.creditRepository.rows.find(
				(row) => row.idempotencyKey === "inv:in_anchor_up:grant",
			)?.meta,
		).toMatchObject({ reason: "subscription_update_anchor_reset" });
		expect(above.outboxRows).toEqual([
			{ chargeId: "ch_anchor_up", triggerRef: "inv:in_anchor_up" },
		]);
		expect(above.reconciliationOutbox.markDoneForCharge).toHaveBeenCalledWith(
			"ch_anchor_up",
		);

		const below = setup(
			subscription({ priceLookupKey: "pro_500_month", tierCredits: 500 }),
		);
		below.repository.seedApplication("pro_250_month");
		below.creditRepository.seedPlan(4_000);
		const belowInvoice = invoice({
			anchorReset: true,
			id: "in_anchor_up_below",
			newKey: "pro_500_month",
			oldKey: "pro_250_month",
			reason: "subscription_update",
		});
		addInvoice(below, belowInvoice);
		await below.service.grantForPaidInvoice(belowInvoice);
		expect((await below.credits.getBalance(OWNER)).plan).toBe(54_000);
		expect(
			below.repository.applications.find(
				(row) => row.stripeInvoiceId === "in_anchor_up_below",
			)?.creditsDelta,
		).toBe(50_000);
	});

	it("replaces yearly slots with the new invoice as funding on an anchor-reset yearly upgrade", async () => {
		const context = setup(
			subscription({
				interval: "year",
				priceLookupKey: "pro_500_year",
				tierCredits: 500,
			}),
		);
		context.repository.seedApplication("pro_250_year");
		context.creditRepository.seedPlan(10_000);
		await context.refill.createYearlySlots(
			{
				credits: 25_000,
				funding: {
					chargeId: "ch_old",
					invoiceId: "in_old",
					paymentIntentId: "pi_old",
				},
				remainingAfter: PERIOD_START,
				subscription: context.repository.canonical as SubscriptionCreditRow,
			},
			{} as SubscriptionCreditsTransaction,
		);
		const upgrade = invoice({
			anchorReset: true,
			fundingChargeId: "ch_new",
			id: "in_year_anchor_up",
			newKey: "pro_500_year",
			oldKey: "pro_250_year",
			paidAt: new Date("2026-05-01T00:00:00.000Z"),
			reason: "subscription_update",
		});
		addInvoice(context, upgrade);
		await context.service.grantForPaidInvoice(upgrade);

		const replaced = context.repository.slots.filter(
			(slot) => slot.status === "canceled",
		);
		expect(replaced).toHaveLength(8);
		expect(replaced.every((slot) => slot.canceledReason === "replaced")).toBe(
			true,
		);
		expect(
			replaced.every(
				(slot) => slot.supersededByInvoiceId === "in_year_anchor_up",
			),
		).toBe(true);
		expect(
			context.repository.slots
				.filter((slot) => slot.status === "granted")
				.map((slot) => slot.periodOrdinal),
		).toEqual([2, 3, 4]);
		expect(
			context.repository.slots.filter(
				(slot) =>
					slot.status === "pending" && slot.fundingChargeId === "ch_new",
			),
		).toHaveLength(11);
		// Catch-up slots funded by the OLD charge get their own recheck.
		expect(
			context.paymentRefunds.reconcileChargeAfterGrant,
		).toHaveBeenCalledWith("ch_new");
		expect(
			context.paymentRefunds.reconcileChargeAfterGrant,
		).toHaveBeenCalledWith("ch_old");
		expect(context.outboxRows).toEqual(
			expect.arrayContaining([
				{ chargeId: "ch_new", triggerRef: "inv:in_year_anchor_up" },
				{ chargeId: "ch_old", triggerRef: "slot:slot_1" },
			]),
		);
	});

	it("dead-letters invoices with unknown prices, off-catalog amounts or foreign currency", async () => {
		const unknown = setup();
		const unknownInvoice = invoice({
			id: "in_unknown",
			newKey: "pro_250_month",
			reason: "subscription_create",
		});
		(
			unknownInvoice.lines.data[0] as unknown as {
				pricing: { price_details: { price: { lookup_key: string } } };
			}
		).pricing.price_details.price.lookup_key = "mystery_plan";
		unknown.stripe.retrieveSubscription.mockResolvedValue({
			items: { data: [] },
		} as never);
		addInvoice(unknown, unknownInvoice);
		await expect(
			unknown.service.grantForPaidInvoice(unknownInvoice),
		).rejects.toThrow("unrecognized or missing price lookup key");

		const mismatch = setup();
		const mismatchInvoice = invoice({
			amountPaid: 1_999,
			fundingChargeId: "ch_mismatch",
			id: "in_mismatch",
			newKey: "pro_250_month",
			reason: "subscription_cycle",
		});
		addInvoice(mismatch, mismatchInvoice);
		await expect(
			mismatch.service.grantForPaidInvoice(mismatchInvoice),
		).rejects.toThrow("paid 1999 minor units but the catalog price");
		expect((await mismatch.credits.getBalance(OWNER)).plan).toBe(0);

		// Same short payment without a customer balance behind it: still a
		// discount we do not model.
		const unbacked = setup();
		const unbackedInvoice = invoice({
			amountPaid: 500,
			customerBalance: { ending: 0, starting: 0 },
			fundingChargeId: "ch_unbacked",
			id: "in_unbacked",
			newKey: "pro_250_month",
			reason: "subscription_cycle",
			total: 2_500,
		});
		addInvoice(unbacked, unbackedInvoice);
		await expect(
			unbacked.service.grantForPaidInvoice(unbackedInvoice),
		).rejects.toThrow("paid 500 minor units but the catalog price");

		const foreign = setup();
		const foreignInvoice = invoice({
			currency: "eur",
			id: "in_eur",
			newKey: "pro_250_month",
			reason: "subscription_create",
		});
		addInvoice(foreign, foreignInvoice);
		await expect(
			foreign.service.grantForPaidInvoice(foreignInvoice),
		).rejects.toThrow("only usd invoices grant credits");

		const trial = setup();
		const trialInvoice = invoice({
			amountPaid: 0,
			id: "in_trial",
			newKey: "pro_250_month",
			reason: "subscription_create",
		});
		addInvoice(trial, trialInvoice);
		await expect(trial.service.grantForPaidInvoice(trialInvoice)).resolves.toBe(
			true,
		);
		expect((await trial.credits.getBalance(OWNER)).plan).toBe(25_000);
	});

	it("grants cycle credits when Stripe pays part of the invoice from the customer balance", async () => {
		// Year -> month is an anchor reset (ruling 7): Stripe credits the unused
		// yearly remainder to the customer balance and the next cycle invoice is
		// paid partly from it. amount_paid (500) is below the catalog price
		// (2500) but the invoice total still matches and the gap is the balance.
		const context = setup();
		const value = invoice({
			amountPaid: 500,
			customerBalance: { ending: 0, starting: -2_000 },
			fundingChargeId: "ch_balance",
			id: "in_balance",
			newKey: "pro_250_month",
			reason: "subscription_cycle",
			total: 2_500,
		});
		addInvoice(context, value);

		await expect(context.service.grantForPaidInvoice(value)).resolves.toBe(
			true,
		);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(25_000);

		// Fully covered by the balance: amount_paid 0 is the trial path and
		// still grants.
		const covered = setup();
		const coveredInvoice = invoice({
			amountPaid: 0,
			customerBalance: { ending: -500, starting: -3_000 },
			id: "in_covered",
			newKey: "pro_250_month",
			reason: "subscription_cycle",
			total: 2_500,
		});
		addInvoice(covered, coveredInvoice);
		await expect(
			covered.service.grantForPaidInvoice(coveredInvoice),
		).resolves.toBe(true);
		expect((await covered.credits.getBalance(OWNER)).plan).toBe(25_000);

		// Balance fields absent: the pre-balance total still proves the gap.
		const totalOnly = setup();
		const totalOnlyInvoice = invoice({
			amountPaid: 1_500,
			fundingChargeId: "ch_total_only",
			id: "in_total_only",
			newKey: "pro_250_month",
			reason: "subscription_cycle",
			total: 2_500,
		});
		addInvoice(totalOnly, totalOnlyInvoice);
		await expect(
			totalOnly.service.grantForPaidInvoice(totalOnlyInvoice),
		).resolves.toBe(true);
	});

	it("changes monthly to yearly with a capped month-one refill and eleven slots", async () => {
		const context = setup(
			subscription({
				interval: "year",
				priceLookupKey: "pro_500_year",
				tierCredits: 500,
			}),
		);
		context.repository.seedApplication("pro_250_month");
		context.creditRepository.seedPlan(50_000);
		const value = invoice({
			anchorReset: true,
			id: "in_to_year",
			newKey: "pro_500_year",
			oldKey: "pro_250_month",
			reason: "subscription_update",
		});
		addInvoice(context, value);
		await context.service.grantForPaidInvoice(value);

		expect((await context.credits.getBalance(OWNER)).plan).toBe(100_000);
		expect(context.repository.slots).toHaveLength(11);
		expect(
			context.repository.applications.find(
				(row) => row.stripeInvoiceId === "in_to_year",
			)?.creditsDelta,
		).toBe(50_000);
	});

	it("reconciles a replayed gross cycle grant even when rollover expiry makes the journal delta non-positive", async () => {
		const context = setup();
		// 60_000 cc pre-balance vs the 250-tier cap (25_000 cc) keeps the journal
		// delta strictly negative: min(60_000, 25_000) + 25_000 = 50_000 →
		// delta -10_000.
		context.creditRepository.seedPlan(60_000);
		context.paymentRefunds.reconcileChargeAfterGrant.mockRejectedValueOnce(
			new Error("simulated post-commit reconciliation outage"),
		);
		const renewal = invoice({
			fundingChargeId: "ch_zero_net_cycle",
			id: "in_zero_net_cycle",
			newKey: "pro_250_month",
			reason: "subscription_cycle",
		});
		addInvoice(context, renewal);

		await expect(context.service.grantForPaidInvoice(renewal)).rejects.toThrow(
			"simulated post-commit reconciliation outage",
		);
		expect(
			context.repository.applications.find(
				(row) => row.stripeInvoiceId === renewal.id,
			)?.creditsDelta,
		).toBe(-10_000);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(50_000);

		await expect(context.service.grantForPaidInvoice(renewal)).resolves.toBe(
			true,
		);
		expect(
			context.paymentRefunds.reconcileChargeAfterGrant,
		).toHaveBeenCalledTimes(2);
		expect(
			context.creditRepository.rows.filter(
				(row) => row.idempotencyKey === `inv:${renewal.id}:grant`,
			),
		).toHaveLength(1);
	});

	it("rejects an update whose same-price predecessor belongs to an older paid period", async () => {
		const context = setup(
			subscription({ priceLookupKey: "pro_500_month", tierCredits: 500 }),
		);
		context.repository.applications.push({
			amountPaidMinor: null,
			appliedAt: new Date(),
			billingReason: "subscription_cycle",
			creditsDelta: 200,
			currency: null,
			newPriceLookupKey: "pro_250_month",
			oldPriceLookupKey: null,
			paidAt: null,
			periodEnd: PERIOD_START,
			periodStart: new Date("2025-12-31T12:00:00.000Z"),
			stripeInvoiceId: "in_previous_period",
			subscriptionId: "sub_local",
		});
		const update = invoice({
			id: "in_wrong_period_predecessor",
			newKey: "pro_500_month",
			oldKey: "pro_250_month",
			reason: "subscription_update",
		});
		addInvoice(context, update);

		await expect(context.service.grantForPaidInvoice(update)).rejects.toThrow(
			"predecessor for the same paid period",
		);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(0);
	});

	it("derives a delayed cycle refill and yearly slots only from that paid invoice", async () => {
		const context = setup(
			subscription({
				interval: "year",
				priceLookupKey: "pro_1000_year",
				tierCredits: 1000,
			}),
		);
		const delayedOldTierRenewal = invoice({
			id: "in_delayed_old_tier_cycle",
			newKey: "pro_250_year",
			reason: "subscription_cycle",
		});
		addInvoice(context, delayedOldTierRenewal);

		await context.service.grantForPaidInvoice(delayedOldTierRenewal);

		expect((await context.credits.getBalance(OWNER)).plan).toBe(25_000);
		expect(
			context.repository.slots
				.filter((slot) => slot.status === "pending")
				.map((slot) => slot.credits),
		).toEqual(Array.from({ length: 11 }, () => 25_000));
		expect(
			context.repository.applications.find(
				(row) => row.stripeInvoiceId === delayedOldTierRenewal.id,
			)?.newPriceLookupKey,
		).toBe("pro_250_year");
	});

	it("defers an out-of-order annual tier update until its interval-change predecessor", async () => {
		const context = setup(
			subscription({
				interval: "year",
				priceLookupKey: "pro_1000_year",
				tierCredits: 1000,
			}),
		);
		context.repository.seedApplication("pro_250_month");
		context.creditRepository.seedPlan(50_000);
		const intervalChange = invoice({
			id: "in_interval_first",
			newKey: "pro_500_year",
			oldKey: "pro_250_month",
			reason: "subscription_update",
		});
		const laterTierUpgrade = invoice({
			id: "in_tier_second",
			newKey: "pro_1000_year",
			oldKey: "pro_500_year",
			reason: "subscription_update",
		});
		addInvoice(context, intervalChange);
		addInvoice(context, laterTierUpgrade);

		await expect(
			context.service.grantForPaidInvoice(laterTierUpgrade),
		).rejects.toThrow("arrived before its pro_500_year predecessor");
		await context.service.grantForPaidInvoice(intervalChange);
		await context.service.grantForPaidInvoice(laterTierUpgrade);

		expect((await context.credits.getBalance(OWNER)).plan).toBe(150_000);
		expect(
			context.repository.slots.filter((slot) => slot.status === "pending"),
		).toHaveLength(11);
		expect(
			context.repository.applications.filter(
				(row) => row.billingReason === "subscription_update",
			),
		).toHaveLength(2);
	});

	it("grants due-but-unswept yearly slots before replacing them on upgrade and renewal", async () => {
		const context = setup(
			subscription({
				interval: "year",
				priceLookupKey: "pro_500_year",
				tierCredits: 500,
			}),
		);
		context.repository.seedApplication("pro_250_year");
		context.creditRepository.seedPlan(10_000);
		await context.refill.createYearlySlots(
			{
				credits: 25_000,
				funding: {
					chargeId: "ch_old",
					invoiceId: "in_old",
					paymentIntentId: "pi_old",
				},
				remainingAfter: PERIOD_START,
				subscription: context.repository.canonical as SubscriptionCreditRow,
			},
			{} as SubscriptionCreditsTransaction,
		);
		const upgrade = invoice({
			id: "in_year_up",
			newKey: "pro_500_year",
			oldKey: "pro_250_year",
			paidAt: new Date("2026-05-01T00:00:00.000Z"),
			reason: "subscription_update",
		});
		addInvoice(context, upgrade);
		await context.service.grantForPaidInvoice(upgrade);
		expect(
			context.repository.slots.filter((slot) => slot.status === "canceled"),
		).toHaveLength(8);
		expect(
			context.repository.slots
				.filter((slot) => slot.status === "granted")
				.map((slot) => slot.periodOrdinal),
		).toEqual([2, 3, 4]);
		expect(
			context.repository.slots.filter((slot) => slot.status === "pending"),
		).toHaveLength(8);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(75_000);

		const renewal = invoice({
			id: "in_year_cycle",
			newKey: "pro_500_year",
			periodEnd: new Date("2028-01-31T12:00:00.000Z"),
			periodStart: PERIOD_END,
			reason: "subscription_cycle",
		});
		addInvoice(context, renewal);
		await context.service.grantForPaidInvoice(renewal);
		expect(
			context.repository.slots.filter((slot) => slot.status === "pending"),
		).toHaveLength(11);
		expect(
			context.repository.slots.filter((slot) => slot.status === "granted"),
		).toHaveLength(11);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(100_000);
	});

	it("sweeps missed slots exactly once with CAS, canonical admission, and stable refill keys", async () => {
		const context = setup(
			subscription({ interval: "year", priceLookupKey: "pro_250_year" }),
		);
		await context.refill.createYearlySlots(
			{
				credits: 25_000,
				funding: {
					chargeId: "ch_1",
					invoiceId: "in_1",
					paymentIntentId: "pi_1",
				},
				remainingAfter: PERIOD_START,
				subscription: context.repository.canonical as SubscriptionCreditRow,
			},
			{} as SubscriptionCreditsTransaction,
		);
		const now = new Date("2026-04-01T00:00:00.000Z");
		const result = await context.refill.sweepDueSlots(now);
		expect(result).toEqual({ canceled: 0, failed: 0, granted: 2, skipped: 0 });
		expect(
			context.creditRepository.rows
				.filter((row) => row.kind === "grant")
				.map((row) => row.idempotencyKey),
		).toEqual(["refill:sub_local:in_1:2", "refill:sub_local:in_1:3"]);
		const racingOutcomes = await Promise.all([
			context.refill.grantDueSlot(
				"slot_3",
				new Date("2026-05-01T00:00:00.000Z"),
			),
			context.refill.grantDueSlot(
				"slot_3",
				new Date("2026-05-01T00:00:00.000Z"),
			),
		]);
		expect(racingOutcomes.sort()).toEqual(["granted", "skipped"]);
		expect(
			context.creditRepository.rows.filter((row) => row.kind === "grant"),
		).toHaveLength(3);
		expect(
			context.creditRepository.rows.find(
				(row) => row.idempotencyKey === "refill:sub_local:in_1:4",
			),
		).toBeDefined();

		const foreign = subscription({
			id: "sub_foreign",
			providerSubscriptionId: "sub_foreign_remote",
		});
		const baseSlot = context.repository.slots[0];
		expect(baseSlot).toBeDefined();
		if (!baseSlot) {
			throw new Error(
				"Expected the yearly subscription to create refill slots",
			);
		}
		context.repository.subscriptions.set(foreign.id, foreign);
		context.repository.slots.push({
			...baseSlot,
			id: "slot_foreign",
			status: "pending",
			subscriptionId: foreign.id,
		});
		await expect(
			context.refill.grantDueSlot("slot_foreign", now),
		).resolves.toBe("canceled");
	});

	it("keeps paid cancel-at-period-end slots, but cancels refund-funded pending slots", async () => {
		const context = setup(
			subscription({
				cancelAtPeriodEnd: true,
				interval: "year",
				priceLookupKey: "pro_250_year",
			}),
		);
		await context.refill.createYearlySlots(
			{
				credits: 25_000,
				funding: {
					chargeId: "ch_refund",
					invoiceId: "in_refund",
					paymentIntentId: "pi_refund",
				},
				remainingAfter: PERIOD_START,
				subscription: context.repository.canonical as SubscriptionCreditRow,
			},
			{} as SubscriptionCreditsTransaction,
		);
		await expect(
			context.refill.grantDueSlot(
				"slot_1",
				new Date("2026-03-01T00:00:00.000Z"),
			),
		).resolves.toBe("granted");
		expect(
			await context.repository.cancelPendingSlotsByFunding({
				chargeId: "ch_refund",
			}),
		).toBe(10);
		expect(
			context.repository.slots.filter((slot) => slot.status === "pending"),
		).toHaveLength(0);
	});

	it("deletion cancels slots and preserves plan credits when another entitled mirror remains", async () => {
		const context = setup();
		context.creditRepository.seedPlan(75);
		context.repository.slots.push({
			credits: 25_000,
			dueAt: new Date(),
			fundingChargeId: "ch_1",
			fundingInvoiceId: "in_1",
			fundingPaymentIntentId: "pi_1",
			canceledAt: null,
			canceledReason: null,
			grantedAt: null,
			id: "slot_delete",
			supersededByInvoiceId: null,
			periodOrdinal: 2,
			status: "pending",
			subscriptionId: "sub_local",
		});
		const second = subscription({
			id: "sub_second",
			providerSubscriptionId: "sub_second_remote",
		});
		context.repository.subscriptions.set(second.id, second);
		context.repository.canonical = second;

		await context.service.expireForDeletedSubscription({
			customer: "cus_1",
			id: "sub_remote",
			metadata: { userId: USER_ID },
		} as unknown as Stripe.Subscription);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(75);
		expect(context.repository.slots[0]?.status).toBe("canceled");

		context.repository.canonical = null;
		await context.service.expireForDeletedSubscription({
			customer: "cus_1",
			id: "sub_remote",
			metadata: { userId: USER_ID },
		} as unknown as Stripe.Subscription);
		expect((await context.credits.getBalance(OWNER)).plan).toBe(0);
	});

	it("keeps unresolved entitled invoice mirrors retryable and cycle staleness scoped away from updates", async () => {
		const noncanonical = setup();
		noncanonical.creditRepository.seedPlan(10);
		noncanonical.repository.canonical = subscription({
			id: "sub_other",
			providerSubscriptionId: "sub_other_remote",
		});
		const rejected = invoice({
			id: "in_noncanonical",
			newKey: "pro_250_month",
			reason: "subscription_cycle",
		});
		addInvoice(noncanonical, rejected);
		await expect(
			noncanonical.service.grantForPaidInvoice(rejected),
		).rejects.toThrow("cannot resolve subscription sub_remote");
		expect((await noncanonical.credits.getBalance(OWNER)).plan).toBe(10);
		expect(noncanonical.repository.applications).toHaveLength(0);

		const context = setup(
			subscription({ priceLookupKey: "pro_1000_month", tierCredits: 1000 }),
		);
		context.repository.applications.push({
			amountPaidMinor: null,
			appliedAt: new Date(),
			billingReason: "subscription_cycle",
			creditsDelta: 200,
			currency: null,
			newPriceLookupKey: "pro_250_month",
			oldPriceLookupKey: null,
			paidAt: null,
			periodEnd: PERIOD_END,
			periodStart: PERIOD_START,
			stripeInvoiceId: "in_newer_cycle",
			subscriptionId: "sub_local",
		});
		const stale = invoice({
			id: "in_stale",
			newKey: "pro_500_month",
			reason: "subscription_cycle",
		});
		addInvoice(context, stale);
		await context.service.grantForPaidInvoice(stale);
		expect(
			context.repository.applications.find(
				(row) => row.stripeInvoiceId === "in_stale",
			)?.creditsDelta,
		).toBe(0);

		context.repository.seedApplication("pro_250_month");
		context.creditRepository.seedPlan(20_000);
		for (const [id, oldKey, newKey] of [
			["in_update_1", "pro_250_month", "pro_500_month"],
			["in_update_2", "pro_500_month", "pro_1000_month"],
		] as const) {
			const update = invoice({
				id,
				newKey,
				oldKey,
				reason: "subscription_update",
			});
			addInvoice(context, update);
			await context.service.grantForPaidInvoice(update);
		}
		expect(
			context.repository.applications.filter(
				(row) => row.billingReason === "subscription_update",
			),
		).toHaveLength(2);
		// 20_000 seeded + 25_000 (250->500) + 50_000 (500->1000) update deltas.
		expect((await context.credits.getBalance(OWNER)).plan).toBe(95_000);
	});
});
