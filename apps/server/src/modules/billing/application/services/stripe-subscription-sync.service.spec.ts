import { Logger } from "@nestjs/common";
import type Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreditOwner } from "../../../credits/domain/credit-owner";
import type { PaymentProvider } from "../../domain/ports/payment-provider.port";
import type {
	BillingCustomerRow,
	BillingCustomersRepository,
} from "../../infrastructure/persistence/billing-customers.repository";
import type {
	SubscriptionRow,
	SubscriptionsRepository,
	SubscriptionsTransaction,
	UpdateSubscriptionProviderStateInput,
	UpsertSubscriptionInput,
} from "../../infrastructure/persistence/subscriptions.repository";
import { StripeSubscriptionSyncService } from "./stripe-subscription-sync.service";

class FakeBillingCustomersRepository {
	readonly providerCustomerIdLookups: string[] = [];

	constructor(private readonly customer: BillingCustomerRow | null) {}

	async findByProviderCustomerId(
		providerCustomerId: string,
	): Promise<BillingCustomerRow | null> {
		this.providerCustomerIdLookups.push(providerCustomerId);

		return this.customer;
	}
}

class FakeSubscriptionsRepository {
	readonly clearMatchingPendingTierCalls: Array<{
		client: SubscriptionsTransaction;
		providerSubscriptionId: string;
		tierCredits: number;
	}> = [];
	readonly lockCustomerIds: string[] = [];
	readonly transaction = {} as SubscriptionsTransaction;
	readonly writes: string[] = [];
	readonly upsertCalls: Array<{
		client: SubscriptionsTransaction;
		input: UpsertSubscriptionInput;
	}> = [];
	private readonly rowsByProviderId = new Map<string, SubscriptionRow>();
	lockActive = false;

	async withStripeCustomerSyncLock<T>(
		providerCustomerId: string,
		fn: (tx: SubscriptionsTransaction) => Promise<T>,
	): Promise<T> {
		this.lockCustomerIds.push(providerCustomerId);
		this.lockActive = true;

		try {
			return await fn(this.transaction);
		} finally {
			this.lockActive = false;
		}
	}

	async upsertByProviderSubscriptionId(
		input: UpsertSubscriptionInput,
		client: SubscriptionsTransaction,
	): Promise<SubscriptionRow> {
		this.upsertCalls.push({ client, input });
		this.assertNonTerminalUnique(
			input.userId,
			input.providerSubscriptionId,
			input.status,
		);

		const existing = this.rowsByProviderId.get(input.providerSubscriptionId);
		const row = {
			...input,
			createdAt: existing?.createdAt ?? new Date(0),
			id: existing?.id ?? `row_${input.providerSubscriptionId}`,
			organizationId: input.organizationId ?? null,
			pendingAppliedBy: existing?.pendingAppliedBy ?? null,
			pendingTierCredits: existing?.pendingTierCredits ?? null,
			updatedAt: new Date(0),
		} satisfies SubscriptionRow;
		this.rowsByProviderId.set(input.providerSubscriptionId, row);
		this.writes.push(`upsert:${input.providerSubscriptionId}:${input.status}`);

		return row;
	}

	async findActiveByOwner(
		owner: CreditOwner,
		_client: SubscriptionsTransaction,
	): Promise<SubscriptionRow | null> {
		return (
			this.rows().find(
				(row) =>
					(owner.type === "user"
						? row.userId === owner.userId && row.organizationId === null
						: row.organizationId === owner.organizationId) &&
					!this.isTerminal(row.status),
			) ?? null
		);
	}

	async findByProviderSubscriptionId(
		providerSubscriptionId: string,
		_client: SubscriptionsTransaction,
	): Promise<SubscriptionRow | null> {
		return this.rowsByProviderId.get(providerSubscriptionId) ?? null;
	}

	async clearMatchingPendingTier(
		providerSubscriptionId: string,
		tierCredits: number,
		client: SubscriptionsTransaction,
	): Promise<SubscriptionRow | null> {
		this.clearMatchingPendingTierCalls.push({
			client,
			providerSubscriptionId,
			tierCredits,
		});
		const existing = this.rowsByProviderId.get(providerSubscriptionId);

		if (!existing || existing.pendingTierCredits !== tierCredits) {
			return null;
		}

		const cleared = {
			...existing,
			pendingAppliedBy: null,
			pendingTierCredits: null,
			updatedAt: new Date(0),
		};
		this.rowsByProviderId.set(providerSubscriptionId, cleared);
		this.writes.push(
			`pending-cleared:${providerSubscriptionId}:${tierCredits}`,
		);

		return cleared;
	}

	async updateStatus(
		providerSubscriptionId: string,
		status: string,
		_client: SubscriptionsTransaction,
	): Promise<SubscriptionRow | null> {
		const existing = this.rowsByProviderId.get(providerSubscriptionId);

		if (!existing) {
			return null;
		}

		this.assertNonTerminalUnique(
			existing.userId,
			providerSubscriptionId,
			status,
		);
		const row = { ...existing, status, updatedAt: new Date(0) };
		this.rowsByProviderId.set(providerSubscriptionId, row);
		this.writes.push(`status:${providerSubscriptionId}:${status}`);

		return row;
	}

	async updateProviderState(
		input: UpdateSubscriptionProviderStateInput,
		_client: SubscriptionsTransaction,
	): Promise<SubscriptionRow | null> {
		const existing = this.rowsByProviderId.get(input.providerSubscriptionId);

		if (!existing) {
			return null;
		}

		this.assertNonTerminalUnique(
			existing.userId,
			input.providerSubscriptionId,
			input.status,
		);
		const row = {
			...existing,
			cancelAtPeriodEnd: input.cancelAtPeriodEnd,
			currentPeriodEnd: input.currentPeriodEnd,
			currentPeriodStart: input.currentPeriodStart,
			status: input.status,
			updatedAt: new Date(0),
		};
		this.rowsByProviderId.set(input.providerSubscriptionId, row);
		this.writes.push(
			`provider-state:${input.providerSubscriptionId}:${input.status}`,
		);

		return row;
	}

	seed(
		input: Partial<SubscriptionRow> &
			Pick<SubscriptionRow, "providerSubscriptionId" | "status" | "userId">,
	) {
		const row = {
			cancelAtPeriodEnd: false,
			createdAt: new Date(0),
			currentPeriodEnd: new Date(200_000),
			currentPeriodStart: new Date(100_000),
			id: `row_${input.providerSubscriptionId}`,
			interval: "month",
			organizationId: null,
			pendingAppliedBy: null,
			pendingTierCredits: null,
			plan: "pro",
			priceLookupKey: "pro_200_month",
			provider: "stripe",
			tierCredits: 200,
			updatedAt: new Date(0),
			...input,
		} satisfies SubscriptionRow;
		this.rowsByProviderId.set(row.providerSubscriptionId, row);

		return row;
	}

	row(providerSubscriptionId: string) {
		return this.rowsByProviderId.get(providerSubscriptionId);
	}

	rows() {
		return [...this.rowsByProviderId.values()];
	}

	private assertNonTerminalUnique(
		userId: string,
		providerSubscriptionId: string,
		status: string,
	) {
		if (this.isTerminal(status)) {
			return;
		}

		const conflicting = this.rows().find(
			(row) =>
				row.userId === userId &&
				row.providerSubscriptionId !== providerSubscriptionId &&
				!this.isTerminal(row.status),
		);

		if (conflicting) {
			throw new Error(
				`subscriptions_userId_nonTerminal_uq: ${conflicting.providerSubscriptionId}`,
			);
		}
	}

	private isTerminal(status: string) {
		return status === "canceled" || status === "incomplete_expired";
	}
}

class FakePaymentProvider {
	readonly listCustomerIds: string[] = [];
	subscriptions: Stripe.Subscription[] = [];
	onList: (() => void) | null = null;

	async listSubscriptionsForCustomer(
		providerCustomerId: string,
	): Promise<Stripe.Subscription[]> {
		this.listCustomerIds.push(providerCustomerId);
		this.onList?.();

		return this.subscriptions;
	}
}

function billingCustomer(): BillingCustomerRow {
	return {
		createdAt: new Date(0),
		id: "billing_customer_1",
		openCheckoutSessionId: null,
		provider: "stripe",
		providerCustomerId: "cus_1",
		updatedAt: new Date(0),
		userId: "user_1",
	};
}

function stripeSubscription(input: {
	cancelAtPeriodEnd?: boolean;
	created?: number;
	currentPeriodEnd?: number;
	currentPeriodStart?: number;
	emptyItems?: boolean;
	id: string;
	lookupKey: string | null;
	status?: Stripe.Subscription.Status;
}): Stripe.Subscription {
	return {
		cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
		created: input.created ?? 100,
		customer: "cus_1",
		id: input.id,
		items: {
			data: input.emptyItems
				? []
				: [
						{
							current_period_end: input.currentPeriodEnd ?? 200,
							current_period_start: input.currentPeriodStart ?? 100,
							id: `item_${input.id}`,
							price: {
								id: `price_${input.id}`,
								lookup_key: input.lookupKey,
							},
						},
					],
		},
		status: input.status ?? "active",
	} as unknown as Stripe.Subscription;
}

function setup(customer: BillingCustomerRow | null = billingCustomer()) {
	const billingCustomers = new FakeBillingCustomersRepository(customer);
	const subscriptions = new FakeSubscriptionsRepository();
	const paymentProvider = new FakePaymentProvider();
	const service = new StripeSubscriptionSyncService(
		billingCustomers as unknown as BillingCustomersRepository,
		subscriptions as unknown as SubscriptionsRepository,
		paymentProvider as unknown as PaymentProvider,
		{ findByProviderCustomerId: async () => null } as never,
	);

	return {
		billingCustomers,
		paymentProvider,
		service,
		subscriptions,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("StripeSubscriptionSyncService", () => {
	it("throws for an unknown customer before listing subscriptions or acquiring a lock", async () => {
		const { billingCustomers, paymentProvider, service, subscriptions } =
			setup(null);

		await expect(service.syncFromStripe("cus_missing")).rejects.toThrow(
			"Could not resolve billing customer for Stripe customer cus_missing",
		);

		expect(billingCustomers.providerCustomerIdLookups).toEqual(["cus_missing"]);
		expect(paymentProvider.listCustomerIds).toEqual([]);
		expect(subscriptions.lockCustomerIds).toEqual([]);
		expect(subscriptions.upsertCalls).toEqual([]);
	});

	it("lists subscriptions from inside the customer lock callback", async () => {
		const { paymentProvider, service, subscriptions } = setup();
		let listedWhileLocked = false;

		paymentProvider.onList = () => {
			listedWhileLocked = subscriptions.lockActive;
		};

		await service.syncFromStripe("cus_1");

		expect(subscriptions.lockCustomerIds).toEqual(["cus_1"]);
		expect(paymentProvider.listCustomerIds).toEqual(["cus_1"]);
		expect(listedWhileLocked).toBe(true);
		expect(subscriptions.lockActive).toBe(false);
	});

	it("maps a valid Stripe subscription, uses the transaction client, and returns the mirrored row", async () => {
		const { paymentProvider, service, subscriptions } = setup();
		paymentProvider.subscriptions = [
			stripeSubscription({
				cancelAtPeriodEnd: true,
				currentPeriodEnd: 1_731_536_000,
				currentPeriodStart: 1_700_000_000,
				id: "sub_pro_yearly",
				lookupKey: "pro_2400_year",
				status: "past_due",
			}),
		];

		const result = await service.syncFromStripe("cus_1");

		expect(subscriptions.upsertCalls).toHaveLength(1);
		expect(subscriptions.upsertCalls[0]?.input).toEqual({
			cancelAtPeriodEnd: true,
			currentPeriodEnd: new Date(1_731_536_000 * 1000),
			currentPeriodStart: new Date(1_700_000_000 * 1000),
			interval: "year",
			organizationId: null,
			plan: "pro",
			priceLookupKey: "pro_2400_year",
			provider: "stripe",
			providerSubscriptionId: "sub_pro_yearly",
			status: "past_due",
			tierCredits: 2400,
			userId: "user_1",
		});
		expect(subscriptions.upsertCalls[0]?.client).toBe(
			subscriptions.transaction,
		);
		expect(result).toEqual(subscriptions.rows());
	});

	it("mirrors only the newest non-terminal subscription and loudly reports duplicates", async () => {
		const duplicateAlert = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const { paymentProvider, service, subscriptions } = setup();
		paymentProvider.subscriptions = [
			stripeSubscription({
				created: 100,
				id: "sub_older",
				lookupKey: "pro_200_month",
			}),
			stripeSubscription({
				created: 200,
				id: "sub_newest",
				lookupKey: "pro_400_year",
			}),
		];

		const result = await service.syncFromStripe("cus_1");

		expect(
			subscriptions.upsertCalls.map(
				(call) => call.input.providerSubscriptionId,
			),
		).toEqual(["sub_newest"]);
		expect(result.map((row) => row.providerSubscriptionId)).toEqual([
			"sub_newest",
		]);
		expect(duplicateAlert).toHaveBeenCalledWith(
			expect.stringContaining("sub_newest"),
		);
		expect(duplicateAlert).toHaveBeenCalledWith(
			expect.stringContaining("sub_older"),
		);
	});

	it("prioritizes an older entitled subscription over newer incomplete, past-due, and unpaid duplicates", async () => {
		const duplicateAlert = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const { paymentProvider, service, subscriptions } = setup();
		paymentProvider.subscriptions = [
			stripeSubscription({
				created: 100,
				id: "sub_active",
				lookupKey: "pro_200_month",
				status: "active",
			}),
			...(["incomplete", "past_due", "unpaid"] as const).map((status, index) =>
				stripeSubscription({
					created: 200 + index,
					id: `sub_${status}`,
					lookupKey: "pro_400_month",
					status,
				}),
			),
		];

		const result = await service.syncFromStripe("cus_1");

		expect(result).toMatchObject([
			{ providerSubscriptionId: "sub_active", status: "active" },
		]);
		expect(
			subscriptions.upsertCalls.map(
				(call) => call.input.providerSubscriptionId,
			),
		).toEqual(["sub_active"]);
		expect(duplicateAlert).toHaveBeenCalledTimes(3);
	});

	it("clears the scheduled tier marker in the same sync transaction once Stripe reaches it", async () => {
		const { paymentProvider, service, subscriptions } = setup();
		subscriptions.seed({
			pendingAppliedBy: "sub_sched_1",
			pendingTierCredits: 200,
			priceLookupKey: "pro_400_month",
			providerSubscriptionId: "sub_scheduled",
			status: "active",
			userId: "user_1",
		});
		paymentProvider.subscriptions = [
			stripeSubscription({
				id: "sub_scheduled",
				lookupKey: "pro_200_month",
				status: "active",
			}),
		];

		await service.syncFromStripe("cus_1");

		expect(subscriptions.row("sub_scheduled")).toMatchObject({
			pendingAppliedBy: null,
			pendingTierCredits: null,
			priceLookupKey: "pro_200_month",
			tierCredits: 200,
		});
		expect(subscriptions.clearMatchingPendingTierCalls).toEqual([
			{
				client: subscriptions.transaction,
				providerSubscriptionId: "sub_scheduled",
				tierCredits: 200,
			},
		]);
	});

	it("cancels an older local mirror before inserting the newest duplicate", async () => {
		const duplicateAlert = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const { paymentProvider, service, subscriptions } = setup();
		subscriptions.seed({
			providerSubscriptionId: "sub_older",
			status: "active",
			userId: "user_1",
		});
		paymentProvider.subscriptions = [
			stripeSubscription({
				created: 100,
				id: "sub_older",
				lookupKey: "pro_200_month",
			}),
			stripeSubscription({
				created: 200,
				id: "sub_newest",
				lookupKey: "pro_400_year",
			}),
		];

		await expect(service.syncFromStripe("cus_1")).resolves.toMatchObject([
			{ providerSubscriptionId: "sub_newest" },
		]);
		expect(subscriptions.writes).toEqual([
			"status:sub_older:canceled",
			"upsert:sub_newest:active",
		]);
		expect(subscriptions.row("sub_older")?.status).toBe("canceled");
		expect(subscriptions.row("sub_newest")?.status).toBe("active");
		expect(duplicateAlert).toHaveBeenCalledOnce();
	});

	it("upserts terminal rows first so they free the unique slot", async () => {
		const { paymentProvider, service, subscriptions } = setup();
		subscriptions.seed({
			providerSubscriptionId: "sub_terminal",
			status: "active",
			userId: "user_1",
		});
		paymentProvider.subscriptions = [
			stripeSubscription({
				created: 100,
				id: "sub_terminal",
				lookupKey: "pro_200_month",
				status: "canceled",
			}),
			stripeSubscription({
				created: 200,
				id: "sub_current",
				lookupKey: "pro_400_year",
			}),
		];

		await service.syncFromStripe("cus_1");

		expect(subscriptions.writes).toEqual([
			"upsert:sub_terminal:canceled",
			"upsert:sub_current:active",
		]);
	});

	it("cancels a local non-terminal mirror absent from Stripe", async () => {
		const { service, subscriptions } = setup();
		subscriptions.seed({
			providerSubscriptionId: "sub_missing",
			status: "past_due",
			userId: "user_1",
		});

		await expect(service.syncFromStripe("cus_1")).resolves.toEqual([]);

		expect(subscriptions.writes).toEqual(["status:sub_missing:canceled"]);
		expect(subscriptions.row("sub_missing")?.status).toBe("canceled");
	});

	it("skips subscriptions with missing or foreign price lookup keys", async () => {
		const warning = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const { paymentProvider, service, subscriptions } = setup();
		paymentProvider.subscriptions = [
			stripeSubscription({
				id: "sub_missing_lookup",
				lookupKey: null,
			}),
			stripeSubscription({
				id: "sub_foreign_lookup",
				lookupKey: "foreign_200_month",
			}),
			stripeSubscription({
				id: "sub_valid",
				lookupKey: "pro_800_month",
			}),
		];

		const result = await service.syncFromStripe("cus_1");

		expect(
			subscriptions.upsertCalls.map(
				(call) => call.input.providerSubscriptionId,
			),
		).toEqual(["sub_valid"]);
		expect(result.map((row) => row.providerSubscriptionId)).toEqual([
			"sub_valid",
		]);
		expect(warning).toHaveBeenCalledTimes(2);
		expect(warning).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("sub_missing_lookup"),
		);
		expect(warning).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("sub_foreign_lookup"),
		);
	});

	it("updates provider state for a tracked foreign price without changing its plan", async () => {
		const warning = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const { paymentProvider, service, subscriptions } = setup();
		subscriptions.seed({
			interval: "year",
			plan: "pro",
			priceLookupKey: "pro_2400_year",
			providerSubscriptionId: "sub_tracked_foreign",
			status: "active",
			tierCredits: 2400,
			userId: "user_1",
		});
		paymentProvider.subscriptions = [
			stripeSubscription({
				cancelAtPeriodEnd: true,
				currentPeriodEnd: 900,
				currentPeriodStart: 800,
				id: "sub_tracked_foreign",
				lookupKey: "foreign_2400_year",
				status: "canceled",
			}),
		];

		await service.syncFromStripe("cus_1");

		expect(subscriptions.writes).toEqual([
			"provider-state:sub_tracked_foreign:canceled",
		]);
		expect(subscriptions.row("sub_tracked_foreign")).toMatchObject({
			cancelAtPeriodEnd: true,
			currentPeriodEnd: new Date(900_000),
			currentPeriodStart: new Date(800_000),
			interval: "year",
			plan: "pro",
			priceLookupKey: "pro_2400_year",
			status: "canceled",
			tierCredits: 2400,
		});
		expect(warning).toHaveBeenCalledWith(
			expect.stringContaining("sub_tracked_foreign"),
		);
	});

	it("propagates status and cancellation when a tracked subscription has no item", async () => {
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		const { paymentProvider, service, subscriptions } = setup();
		const existing = subscriptions.seed({
			providerSubscriptionId: "sub_no_item",
			status: "active",
			userId: "user_1",
		});
		paymentProvider.subscriptions = [
			stripeSubscription({
				cancelAtPeriodEnd: true,
				emptyItems: true,
				id: "sub_no_item",
				lookupKey: null,
				status: "canceled",
			}),
		];

		await service.syncFromStripe("cus_1");

		expect(subscriptions.row("sub_no_item")).toMatchObject({
			cancelAtPeriodEnd: true,
			currentPeriodEnd: existing.currentPeriodEnd,
			currentPeriodStart: existing.currentPeriodStart,
			status: "canceled",
		});
	});
});
