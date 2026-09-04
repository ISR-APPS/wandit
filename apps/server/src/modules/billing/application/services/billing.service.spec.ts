import { BadRequestException, ConflictException, Logger } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import type { CreditOwner } from "../../../credits/domain/credit-owner";
import { WorkspaceNotSupportedError } from "../../../workspaces/domain/errors/workspace.errors";
import type { WorkspaceContext } from "../../../workspaces/domain/workspace-context";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import { AmbiguousPaymentProviderWriteError } from "../../domain/errors/ambiguous-payment-provider-write.error";
import { BillingNotConfiguredError } from "../../domain/errors/billing-not-configured.error";
import { ManualSubscriptionUnsupportedError } from "../../domain/errors/manual-billing.errors";
import { PaymentPastDueError } from "../../domain/errors/payment-past-due.error";
import {
	BillingChangeIntentExpiredError,
	BillingChangeIntentInvalidError,
	SubscriptionChangePendingError,
	YearlyToMonthlyUnsupportedError,
} from "../../domain/errors/subscription-change.errors";
import type {
	PaymentProvider,
	SubscriptionChangeProviderResult,
} from "../../domain/ports/payment-provider.port";
import type {
	BillingChangeIntentRow,
	BillingChangeIntentsRepository,
	BillingChangeIntentTransaction,
} from "../../infrastructure/persistence/billing-change-intents.repository";
import type {
	BillingCheckoutAttemptRow,
	BillingCheckoutAttemptsRepository,
	BillingCheckoutAttemptTransaction,
} from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import type {
	BillingCustomerRow,
	BillingCustomersRepository,
} from "../../infrastructure/persistence/billing-customers.repository";
import type {
	CancellationReasonRow,
	CancellationReasonsRepository,
	InsertCancellationReason,
} from "../../infrastructure/persistence/cancellation-reasons.repository";
import type {
	SubscriptionRow,
	SubscriptionsRepository,
	SubscriptionsTransaction,
} from "../../infrastructure/persistence/subscriptions.repository";
import { BillingService } from "./billing.service";
import type { BillingCustomerService } from "./billing-customer.service";
import type { StripeSubscriptionSyncService } from "./stripe-subscription-sync.service";

const NOW = new Date("2026-08-01T12:34:56.789Z");
const PRORATION_DATE = new Date("2026-08-01T12:34:56.000Z");
const INTENT_ID = "33333333-3333-4333-8333-333333333333";
const CANCELLATION_REASON_ID = "55555555-5555-4555-8555-555555555555";

const user = {
	email: "user@example.com",
	id: "user_1",
} as AuthUser;

const orgWorkspace = {
	kind: "org",
	organizationId: "org_1",
	role: "owner",
	roles: ["owner"],
} satisfies WorkspaceContext;

function billingCustomer(): BillingCustomerRow {
	return {
		createdAt: new Date("2026-07-24T10:00:00.000Z"),
		id: "11111111-1111-4111-8111-111111111111",
		openCheckoutSessionId: null,
		provider: "stripe",
		providerCustomerId: "cus_1",
		updatedAt: new Date("2026-07-24T10:00:00.000Z"),
		userId: user.id,
	};
}

function subscriptionRow(
	overrides: Partial<SubscriptionRow> = {},
): SubscriptionRow {
	return {
		cancelAtPeriodEnd: false,
		createdAt: new Date("2026-07-24T10:00:00.000Z"),
		currentPeriodEnd: new Date("2026-08-24T10:00:00.000Z"),
		currentPeriodStart: new Date("2026-07-24T10:00:00.000Z"),
		id: "22222222-2222-4222-8222-222222222222",
		interval: "month",
		organizationId: null,
		pendingAppliedBy: null,
		pendingPlan: null,
		pendingInterval: null,
		pendingTierCredits: null,
		plan: "pro",
		priceLookupKey: "pro_250_month",
		provider: "stripe",
		providerSubscriptionId: "sub_1",
		status: "active",
		tierCredits: 250,
		updatedAt: new Date("2026-07-24T10:00:00.000Z"),
		userId: user.id,
		...overrides,
	};
}

function checkoutAttempt(
	overrides: Partial<BillingCheckoutAttemptRow> = {},
): BillingCheckoutAttemptRow {
	return {
		createdAt: new Date(NOW),
		id: "44444444-4444-4444-8444-444444444444",
		organizationId: null,
		packId: null,
		priceLookupKey: "pro_250_month",
		providerSessionId: null,
		purpose: "subscription",
		status: "created",
		updatedAt: new Date(NOW),
		userId: user.id,
		...overrides,
	};
}

function changeIntent(
	overrides: Partial<BillingChangeIntentRow> = {},
): BillingChangeIntentRow {
	return {
		anchorReset: false,
		consumedAt: null,
		createdAt: new Date(NOW),
		currency: "usd",
		currentPriceLookupKey: "pro_250_month",
		expiresAt: new Date(NOW.getTime() + 15 * 60 * 1000),
		id: INTENT_ID,
		organizationId: null,
		previewTotalMinor: 2_500,
		prorationDate: new Date(PRORATION_DATE),
		providerAttemptedAt: null,
		providerHostedInvoiceUrl: null,
		providerOutcome: null,
		providerPendingExpiresAt: null,
		status: "open",
		subscriptionId: "22222222-2222-4222-8222-222222222222",
		targetPriceLookupKey: "pro_500_month",
		userId: user.id,
		...overrides,
	};
}

class FakeBillingCustomersRepository {
	customer: BillingCustomerRow | null = billingCustomer();

	readonly findByUserId = vi.fn(async () => this.customer);
	readonly setOpenCheckoutSessionId = vi.fn(
		async (_userId: string, openCheckoutSessionId: string) => {
			if (!this.customer) {
				throw new Error("Missing billing customer");
			}

			this.customer = { ...this.customer, openCheckoutSessionId };

			return this.customer;
		},
	);
}

class FakeSubscriptionsRepository {
	readonly transaction = {
		kind: "subscription-transaction",
	} as unknown as SubscriptionsTransaction;
	row: SubscriptionRow | null;

	readonly findActiveByOwner = vi.fn(
		async (owner: CreditOwner, _client?: unknown) =>
			this.row &&
			(owner.type === "user"
				? this.row.userId === owner.userId && this.row.organizationId === null
				: this.row.organizationId === owner.organizationId)
				? this.row
				: null,
	);
	readonly findByProviderSubscriptionId = vi.fn(async () => this.row);
	readonly markPendingTierApplied = vi.fn(
		async (_providerSubscriptionId: string, appliedBy: string) => {
			if (!this.row?.pendingTierCredits || this.row.pendingAppliedBy !== null) {
				return null;
			}

			this.row = { ...this.row, pendingAppliedBy: appliedBy };

			return this.row;
		},
	);
	readonly setPendingTierCredits = vi.fn(
		async (
			_providerSubscriptionId: string,
			pendingTierCredits: SubscriptionRow["pendingTierCredits"],
			_client?: unknown,
			target?: {
				plan: SubscriptionRow["plan"];
				interval: SubscriptionRow["interval"];
			},
		) => {
			if (!this.row) {
				return null;
			}

			this.row = {
				...this.row,
				pendingAppliedBy: null,
				pendingTierCredits,
				pendingPlan:
					pendingTierCredits === null ? null : (target?.plan ?? null),
				pendingInterval:
					pendingTierCredits === null ? null : (target?.interval ?? null),
			};

			return this.row;
		},
	);
	readonly updateCancelAtPeriodEnd = vi.fn(
		async (_providerSubscriptionId: string, cancelAtPeriodEnd: boolean) => {
			if (!this.row) {
				return null;
			}

			this.row = { ...this.row, cancelAtPeriodEnd };

			return this.row;
		},
	);
	readonly updateTierAndPrice = vi.fn(
		async (
			_providerSubscriptionId: string,
			tierCredits: SubscriptionRow["tierCredits"],
			priceLookupKey: string,
		) => {
			if (!this.row) {
				return null;
			}

			this.row = { ...this.row, priceLookupKey, tierCredits };

			return this.row;
		},
	);

	constructor(row: SubscriptionRow | null) {
		this.row = row;
	}
}

class FakeCreditsService {
	balance = { balance: 0, plan: 0, promo: 0, topup: 0 };
	readonly getBalance = vi.fn(async () => this.balance);
	readonly getSettledBalance = vi.fn(async () => ({
		...this.balance,
		settledBalance: this.balance.balance,
		settledPlan: this.balance.plan,
		settledPromo: this.balance.promo,
		settledTopup: this.balance.topup,
	}));
}

class FakePaymentProvider {
	readonly calls: string[];
	subscriptions: Stripe.Subscription[] = [];
	pendingUpdate = false;

	readonly changeSubscription = vi.fn(
		async (
			_params: Parameters<PaymentProvider["changeSubscription"]>[0],
		): Promise<SubscriptionChangeProviderResult> => {
			this.calls.push("provider-change");

			return { outcome: "applied" as const };
		},
	);
	readonly cancelScheduledSubscriptionDowngrade = vi.fn(async () => {
		this.calls.push("provider-cancel-schedule");
	});
	readonly createSubscriptionCheckout = vi.fn(async () => {
		this.calls.push("provider-subscription-checkout");

		return {
			id: "cs_subscription",
			url: "https://checkout.stripe.test/cs_subscription",
		};
	});
	readonly createTopupCheckout = vi.fn(async () => {
		this.calls.push("provider-topup-checkout");

		return {
			id: "cs_topup",
			url: "https://checkout.stripe.test/cs_topup",
		};
	});
	readonly createPortalSession = vi.fn(
		async () => "https://billing.stripe.test",
	);
	readonly expireCheckoutSession = vi.fn(
		async (): Promise<Stripe.Checkout.Session["status"]> => "expired",
	);
	readonly hasPendingSubscriptionUpdate = vi.fn(async () => this.pendingUpdate);
	readonly listSubscriptionsForCustomer = vi.fn(async () => this.subscriptions);
	readonly previewSubscriptionChange = vi.fn(async () => ({
		amountDueMinor: 2_500,
		currency: "USD",
	}));
	readonly retrieveCheckoutSession = vi.fn(async () => ({ status: "open" }));
	readonly scheduleSubscriptionDowngrade = vi.fn(
		async (
			_params: Parameters<PaymentProvider["scheduleSubscriptionDowngrade"]>[0],
		) => "sub_sched_1",
	);
	readonly setCancelAtPeriodEnd = vi.fn();
	readonly switchSubscriptionPriceWithoutProration = vi.fn(
		async () => undefined,
	);

	constructor(calls: string[]) {
		this.calls = calls;
	}
}

class FakeBillingCustomerService {
	customer = billingCustomer();
	readonly ensureCustomer = vi.fn(async () => this.customer);
	readonly ensureOrgCustomer = vi.fn(async () => ({
		providerCustomerId: "cus_org_1",
	}));
}

class FakeSubscriptionSyncService {
	readonly syncFromStripe = vi.fn(async (): Promise<SubscriptionRow[]> => []);
}

type CreateAttemptInput = {
	id: string;
	organizationId?: string | null;
	packId?: string;
	priceLookupKey?: string;
	purpose: "subscription" | "topup";
	userId: string;
};

class FakeCheckoutAttemptsRepository {
	readonly calls: string[];
	readonly transaction = {
		kind: "checkout-attempt-transaction",
	} as unknown as BillingCheckoutAttemptTransaction;
	rows: BillingCheckoutAttemptRow[] = [];
	attachSucceeds = true;

	readonly findOpenForOwner = vi.fn(
		async (owner: CreditOwner, purpose: "subscription" | "topup") =>
			this.rows.filter(
				(row) =>
					(owner.type === "user"
						? row.userId === owner.userId && row.organizationId === null
						: row.organizationId === owner.organizationId) &&
					row.purpose === purpose &&
					(row.status === "created" || row.status === "session_attached"),
			),
	);
	readonly findById = vi.fn(async (id: string) => {
		return this.rows.find((row) => row.id === id) ?? null;
	});
	readonly create = vi.fn(async (input: CreateAttemptInput) => {
		this.calls.push("create-attempt");
		this.assertPurposeInvariant(input);
		const row = checkoutAttempt({
			id: input.id,
			organizationId: input.organizationId ?? null,
			packId: input.packId ?? null,
			priceLookupKey: input.priceLookupKey ?? null,
			purpose: input.purpose,
			userId: input.userId,
		});
		this.rows.push(row);

		return row;
	});
	readonly attachSession = vi.fn(
		async (id: string, providerSessionId: string) => {
			this.calls.push("attach-session");

			if (!this.attachSucceeds) {
				return null;
			}

			const index = this.rows.findIndex((row) => row.id === id);

			if (index === -1 || this.rows[index]?.status !== "created") {
				return null;
			}

			const attached = {
				...this.rows[index],
				providerSessionId,
				status: "session_attached" as const,
			};
			this.rows[index] = attached;

			return attached;
		},
	);
	readonly markExpired = vi.fn(async (id: string) => {
		const index = this.rows.findIndex((row) => row.id === id);
		const existing = this.rows[index];

		if (!existing) {
			return false;
		}

		this.rows[index] = { ...existing, status: "expired" };

		return true;
	});

	constructor(calls: string[]) {
		this.calls = calls;
	}

	withUserLock<T>(
		_userId: string,
		operation: (tx: BillingCheckoutAttemptTransaction) => Promise<T>,
	): Promise<T> {
		return operation(this.transaction);
	}

	withOwnerLock<T>(
		_owner: CreditOwner,
		operation: (tx: BillingCheckoutAttemptTransaction) => Promise<T>,
	): Promise<T> {
		return operation(this.transaction);
	}

	private assertPurposeInvariant(input: CreateAttemptInput): void {
		const valid =
			(input.purpose === "subscription" &&
				!!input.priceLookupKey &&
				!input.packId) ||
			(input.purpose === "topup" && !!input.packId && !input.priceLookupKey);

		if (!valid) {
			throw new Error(`Invalid ${input.purpose} checkout attempt`);
		}
	}
}

class FakeChangeIntentsRepository {
	readonly transaction = {
		kind: "change-intent-transaction",
	} as unknown as BillingChangeIntentTransaction;
	intent: BillingChangeIntentRow | null = null;
	consumeSucceeds = true;

	readonly create = vi.fn(
		async (
			input: Omit<
				BillingChangeIntentRow,
				| "consumedAt"
				| "createdAt"
				| "id"
				| "providerAttemptedAt"
				| "providerHostedInvoiceUrl"
				| "providerOutcome"
				| "providerPendingExpiresAt"
			>,
		) => {
			this.intent = changeIntent({ ...input, id: INTENT_ID });

			return this.intent;
		},
	);
	readonly findById = vi.fn(async (id: string) =>
		this.intent?.id === id ? this.intent : null,
	);
	readonly beginProviderAttempt = vi.fn(
		async (_id: string, _userId: string, now: Date) => {
			if (this.intent?.status !== "open" || !this.consumeSucceeds) {
				return null;
			}

			this.intent = {
				...this.intent,
				providerAttemptedAt: now,
				status: "processing",
			};

			return this.intent;
		},
	);
	readonly completeProviderAttempt = vi.fn(
		async (input: {
			hostedInvoiceUrl?: string;
			id: string;
			now: Date;
			outcome: "applied" | "failed" | "payment_required";
			pendingExpiresAt?: Date;
			userId: string;
		}) => {
			if (this.intent?.status !== "processing") {
				return this.intent?.status === "consumed" ? this.intent : null;
			}

			this.intent = {
				...this.intent,
				consumedAt: input.now,
				providerHostedInvoiceUrl: input.hostedInvoiceUrl ?? null,
				providerOutcome: input.outcome,
				providerPendingExpiresAt: input.pendingExpiresAt ?? null,
				status: "consumed",
			};

			return this.intent;
		},
	);
	readonly findOtherProcessingForSubscription = vi.fn(async () => null);
	readonly expireIfOpen = vi.fn(async (_id: string, _now: Date) => {
		if (this.intent?.status !== "open") {
			return false;
		}

		this.intent = { ...this.intent, status: "expired" };

		return true;
	});

	async withUserLock<T>(
		_userId: string,
		operation: (tx: BillingChangeIntentTransaction) => Promise<T>,
	): Promise<T> {
		const snapshot = structuredClone(this.intent);

		try {
			return await operation(this.transaction);
		} catch (error) {
			this.intent = snapshot;
			throw error;
		}
	}

	async withOwnerLock<T>(
		_owner: unknown,
		operation: (tx: BillingChangeIntentTransaction) => Promise<T>,
	): Promise<T> {
		const snapshot = structuredClone(this.intent);

		try {
			return await operation(this.transaction);
		} catch (error) {
			this.intent = snapshot;
			throw error;
		}
	}
}

class FakeCancellationReasonsRepository {
	row: CancellationReasonRow | null = null;

	readonly createPending = vi.fn(
		async (
			input: Omit<InsertCancellationReason, "status">,
		): Promise<CancellationReasonRow> => {
			const row: CancellationReasonRow = {
				createdAt: new Date(NOW),
				details: input.details ?? null,
				endedStateEventId: input.endedStateEventId ?? null,
				id: CANCELLATION_REASON_ID,
				organizationId: input.organizationId ?? null,
				reason: input.reason,
				status: "pending",
				stripeSubscriptionId: input.stripeSubscriptionId,
				submittedByUserId: input.submittedByUserId,
				subscriptionId: input.subscriptionId ?? null,
				subscriptionUserId: input.subscriptionUserId,
				updatedAt: new Date(NOW),
			};
			this.row = row;

			return row;
		},
	);
	readonly markPendingOutcome = vi.fn(
		async (
			id: string,
			status: "provider_failed" | "scheduled",
		): Promise<boolean> => {
			if (this.row?.id !== id || this.row.status !== "pending") {
				return false;
			}

			this.row = { ...this.row, status };
			return true;
		},
	);
	readonly markNewestScheduledResumed = vi.fn(async (): Promise<boolean> => {
		if (this.row?.status !== "scheduled") {
			return false;
		}

		this.row = { ...this.row, status: "resumed" };
		return true;
	});
}

function setup(row: SubscriptionRow | null = subscriptionRow()) {
	const calls: string[] = [];
	const billingCustomers = new FakeBillingCustomersRepository();
	const subscriptions = new FakeSubscriptionsRepository(row);
	const credits = new FakeCreditsService();
	const paymentProvider = new FakePaymentProvider(calls);
	const billingCustomerService = new FakeBillingCustomerService();
	const subscriptionSync = new FakeSubscriptionSyncService();
	const checkoutAttempts = new FakeCheckoutAttemptsRepository(calls);
	const changeIntents = new FakeChangeIntentsRepository();
	const cancellationReasons = new FakeCancellationReasonsRepository();
	const service = new BillingService(
		billingCustomers as unknown as BillingCustomersRepository,
		subscriptions as unknown as SubscriptionsRepository,
		credits as unknown as CreditsService,
		paymentProvider as unknown as PaymentProvider,
		billingCustomerService as unknown as BillingCustomerService,
		subscriptionSync as unknown as StripeSubscriptionSyncService,
		checkoutAttempts as unknown as BillingCheckoutAttemptsRepository,
		changeIntents as unknown as BillingChangeIntentsRepository,
		{
			findByOrganizationId: async () => null,
			setOpenCheckoutSessionId: async () => undefined,
		} as never,
		{
			get: async () => ({
				organizationsEnabled: false,
				paidSubscriptionsEnabled: true,
			}),
		} as never,
		cancellationReasons as unknown as CancellationReasonsRepository,
	);

	return {
		billingCustomers,
		billingCustomerService,
		cancellationReasons,
		calls,
		changeIntents,
		checkoutAttempts,
		credits,
		paymentProvider,
		service,
		subscriptions,
		subscriptionSync,
	};
}

function stripeSubscription(
	status: Stripe.Subscription.Status,
	id = `sub_${status}`,
): Stripe.Subscription {
	return { created: 100, id, status } as Stripe.Subscription;
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("BillingService entitlement and sync", () => {
	it("publishes only the purchasable tiers for each plan", () => {
		const { service } = setup();
		const catalog = service.plans();

		expect(
			catalog.plans.map((plan) => ({
				id: plan.id,
				tiers: plan.tiers.map((tier) => tier.tierCredits),
			})),
		).toEqual([
			{ id: "starter", tiers: [60] },
			{
				id: "pro",
				tiers: [250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500],
			},
			{
				id: "business",
				tiers: [250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500],
			},
		]);
		expect(catalog.topupPacks.map((pack) => pack.id)).toEqual([
			"topup_250",
			"topup_1000",
			"topup_2500",
		]);
	});

	it.each([
		"active",
		"trialing",
	])("treats %s subscriptions as entitled", async (status) => {
		const { service } = setup(subscriptionRow({ status }));

		await expect(service.hasActiveSubscription(user.id)).resolves.toBe(true);
		await expect(service.getSubscriptionView(user.id)).resolves.toMatchObject({
			subscription: { entitled: true, status },
		});
	});

	it("shows past_due subscriptions without granting entitlement", async () => {
		const { service } = setup(subscriptionRow({ status: "past_due" }));

		await expect(service.hasActiveSubscription(user.id)).resolves.toBe(false);
		await expect(service.getSubscriptionView(user.id)).resolves.toMatchObject({
			balance: {
				balance: 0,
				plan: 0,
				promo: 0,
				settledBalance: 0,
				settledPlan: 0,
				settledPromo: 0,
				settledTopup: 0,
				topup: 0,
			},
			subscription: { entitled: false, status: "past_due" },
		});
	});

	it("blocks local and remote nonterminal subscriptions before checkout", async () => {
		const local = setup();

		await expect(
			local.service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).rejects.toBeInstanceOf(ActiveSubscriptionExistsError);
		expect(local.billingCustomerService.ensureCustomer).not.toHaveBeenCalled();

		const remote = setup(null);
		remote.paymentProvider.subscriptions = [stripeSubscription("active")];

		await expect(
			remote.service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).rejects.toBeInstanceOf(ActiveSubscriptionExistsError);
		expect(
			remote.paymentProvider.createSubscriptionCheckout,
		).not.toHaveBeenCalled();
	});

	it("rechecks local subscriptions under the checkout owner lock", async () => {
		const context = setup(null);
		context.subscriptions.findActiveByOwner
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(
				subscriptionRow({
					provider: "manual",
					providerSubscriptionId: "manual_grant_1",
				}),
			);

		await expect(
			context.service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).rejects.toBeInstanceOf(ActiveSubscriptionExistsError);

		expect(context.checkoutAttempts.create).not.toHaveBeenCalled();
		expect(
			context.paymentProvider.listSubscriptionsForCustomer,
		).not.toHaveBeenCalled();
	});

	it("maps local and remote past_due blockers to the payment-attention error", async () => {
		const local = setup(subscriptionRow({ status: "past_due" }));

		await expect(
			local.service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).rejects.toBeInstanceOf(PaymentPastDueError);

		const remote = setup(null);
		remote.paymentProvider.subscriptions = [stripeSubscription("past_due")];

		await expect(
			remote.service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).rejects.toBeInstanceOf(PaymentPastDueError);
	});

	it("returns the local view when sync has no customer or Stripe is unconfigured", async () => {
		const noCustomer = setup();
		noCustomer.billingCustomers.customer = null;

		await expect(noCustomer.service.sync(user)).resolves.toMatchObject({
			subscription: { status: "active" },
		});
		expect(noCustomer.subscriptionSync.syncFromStripe).not.toHaveBeenCalled();

		const unconfigured = setup();
		unconfigured.subscriptionSync.syncFromStripe.mockRejectedValueOnce(
			new BillingNotConfiguredError("STRIPE_SECRET_KEY"),
		);

		await expect(unconfigured.service.sync(user)).resolves.toMatchObject({
			subscription: { status: "active" },
		});
	});

	it("does not hide non-configuration sync failures", async () => {
		const { service, subscriptionSync } = setup();
		subscriptionSync.syncFromStripe.mockRejectedValueOnce(
			new Error("Stripe request failed"),
		);

		await expect(service.sync(user)).rejects.toThrow("Stripe request failed");
	});
});

describe("BillingService cancellation-reason lifecycle", () => {
	it("persists the owner context before Stripe and marks the cycle scheduled after provider success", async () => {
		const { cancellationReasons, paymentProvider, service, subscriptions } =
			setup(
				subscriptionRow({
					organizationId: "org_1",
					userId: "user_subscription_owner",
				}),
			);
		const workspace = {
			kind: "org",
			organizationId: "org_1",
			role: "owner",
			roles: ["owner"],
		} satisfies WorkspaceContext;

		await service.cancel(
			user,
			{ details: "Needed a capability", reason: "missing_features" },
			workspace,
		);

		expect(cancellationReasons.createPending).toHaveBeenCalledWith({
			details: "Needed a capability",
			organizationId: "org_1",
			reason: "missing_features",
			stripeSubscriptionId: "sub_1",
			submittedByUserId: user.id,
			subscriptionId: "22222222-2222-4222-8222-222222222222",
			subscriptionUserId: "user_subscription_owner",
		});
		expect(paymentProvider.setCancelAtPeriodEnd).toHaveBeenCalledWith(
			"sub_1",
			true,
		);
		expect(cancellationReasons.markPendingOutcome).toHaveBeenCalledWith(
			CANCELLATION_REASON_ID,
			"scheduled",
		);
		expect(subscriptions.updateCancelAtPeriodEnd).toHaveBeenCalledWith(
			"sub_1",
			true,
		);
		expect(
			cancellationReasons.createPending.mock.invocationCallOrder[0],
		).toBeLessThan(
			paymentProvider.setCancelAtPeriodEnd.mock.invocationCallOrder[0] ?? 0,
		);
		expect(
			paymentProvider.setCancelAtPeriodEnd.mock.invocationCallOrder[0],
		).toBeLessThan(
			cancellationReasons.markPendingOutcome.mock.invocationCallOrder[0] ?? 0,
		);
		expect(cancellationReasons.row?.status).toBe("scheduled");
	});

	it("marks the pending cycle provider_failed and preserves the Stripe failure", async () => {
		const { cancellationReasons, paymentProvider, service, subscriptions } =
			setup();
		const providerError = new Error("Stripe cancellation failed");
		paymentProvider.setCancelAtPeriodEnd.mockRejectedValueOnce(providerError);

		await expect(
			service.cancel(user, { reason: "too_expensive" }),
		).rejects.toBe(providerError);

		expect(cancellationReasons.markPendingOutcome).toHaveBeenCalledWith(
			CANCELLATION_REASON_ID,
			"provider_failed",
		);
		expect(cancellationReasons.row?.status).toBe("provider_failed");
		expect(subscriptions.updateCancelAtPeriodEnd).not.toHaveBeenCalled();
	});

	it("still rethrows the original Stripe failure when provider_failed persistence fails", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const { cancellationReasons, paymentProvider, service } = setup();
		const providerError = new Error("Stripe cancellation failed");
		paymentProvider.setCancelAtPeriodEnd.mockRejectedValueOnce(providerError);
		cancellationReasons.markPendingOutcome.mockRejectedValueOnce(
			new Error("database unavailable"),
		);

		await expect(
			service.cancel(user, { reason: "not_using_enough" }),
		).rejects.toBe(providerError);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("Could not mark cancellation reason"),
			expect.stringContaining("database unavailable"),
		);
	});

	it("marks the newest scheduled cancellation cycle resumed after un-canceling", async () => {
		const { cancellationReasons, paymentProvider, service } = setup();

		await service.cancel(user, { reason: "temporary_pause" });
		await service.resume(user);

		expect(paymentProvider.setCancelAtPeriodEnd).toHaveBeenLastCalledWith(
			"sub_1",
			false,
		);
		expect(cancellationReasons.markNewestScheduledResumed).toHaveBeenCalledWith(
			"sub_1",
		);
		expect(cancellationReasons.row?.status).toBe("resumed");
	});

	it("schedules the v6 renewal target when a yearly legacy subscription resumes", async () => {
		const { changeIntents, paymentProvider, service, subscriptions } = setup(
			subscriptionRow({
				cancelAtPeriodEnd: true,
				interval: "year",
				priceLookupKey: "pro_175_year",
				tierCredits: 175,
			}),
		);
		paymentProvider.scheduleSubscriptionDowngrade.mockResolvedValueOnce(
			"sub_sched_v6_resume",
		);

		await service.resume(user);

		expect(paymentProvider.setCancelAtPeriodEnd).toHaveBeenCalledWith(
			"sub_1",
			false,
		);
		expect(paymentProvider.scheduleSubscriptionDowngrade).toHaveBeenCalledWith({
			allowSameIntentRecovery: true,
			currentPriceLookupKey: "pro_175_year",
			expectedScheduleTarget: null,
			idempotencyKey: "billing-migrate-v6:year:sub_1:pro_250_year",
			newPriceLookupKey: "pro_250_year",
			providerSubscriptionId: "sub_1",
		});
		expect(subscriptions.setPendingTierCredits).toHaveBeenCalledWith(
			"sub_1",
			250,
			changeIntents.transaction,
		);
		expect(subscriptions.markPendingTierApplied).toHaveBeenCalledWith(
			"sub_1",
			"sub_sched_v6_resume",
			changeIntents.transaction,
		);
		expect(subscriptions.row).toMatchObject({
			cancelAtPeriodEnd: false,
			pendingAppliedBy: "sub_sched_v6_resume",
			pendingTierCredits: 250,
			priceLookupKey: "pro_175_year",
			tierCredits: 175,
		});
	});

	it("replays yearly legacy resume scheduling after local persistence fails", async () => {
		const { paymentProvider, service, subscriptions } = setup(
			subscriptionRow({
				cancelAtPeriodEnd: true,
				interval: "year",
				priceLookupKey: "pro_175_year",
				tierCredits: 175,
			}),
		);
		subscriptions.setPendingTierCredits.mockRejectedValueOnce(
			new Error("pending tier persistence unavailable"),
		);

		await expect(service.resume(user)).rejects.toThrow(
			"pending tier persistence unavailable",
		);
		expect(subscriptions.row).toMatchObject({
			cancelAtPeriodEnd: true,
			pendingAppliedBy: null,
			pendingTierCredits: null,
		});

		await expect(service.resume(user)).resolves.toMatchObject({
			subscription: {
				cancelAtPeriodEnd: false,
				pendingTierCredits: 250,
			},
		});
		expect(paymentProvider.scheduleSubscriptionDowngrade).toHaveBeenCalledTimes(
			2,
		);
		expect(
			paymentProvider.scheduleSubscriptionDowngrade.mock.calls.map(
				([params]) => params.idempotencyKey,
			),
		).toEqual([
			"billing-migrate-v6:year:sub_1:pro_250_year",
			"billing-migrate-v6:year:sub_1:pro_250_year",
		]);
	});

	it("switches a monthly legacy subscription to its v6 tier when it resumes", async () => {
		const { paymentProvider, service, subscriptions } = setup(
			subscriptionRow({
				cancelAtPeriodEnd: true,
				priceLookupKey: "pro_175_month",
				tierCredits: 175,
			}),
		);

		await service.resume(user);

		expect(
			paymentProvider.switchSubscriptionPriceWithoutProration,
		).toHaveBeenCalledWith({
			currentPriceLookupKey: "pro_175_month",
			idempotencyKey: "billing-migrate-v6:month:sub_1:pro_250_month",
			newPriceLookupKey: "pro_250_month",
			providerSubscriptionId: "sub_1",
		});
		expect(subscriptions.updateTierAndPrice).toHaveBeenCalledWith(
			"sub_1",
			250,
			"pro_250_month",
		);
		expect(
			paymentProvider.scheduleSubscriptionDowngrade,
		).not.toHaveBeenCalled();
		expect(subscriptions.row).toMatchObject({
			cancelAtPeriodEnd: false,
			priceLookupKey: "pro_250_month",
			tierCredits: 250,
		});
	});

	it("resumes a manual subscription even while Stripe subscriptions are paused", async () => {
		const { paymentProvider, service, subscriptions } = setup(
			subscriptionRow({
				cancelAtPeriodEnd: true,
				provider: "manual",
				providerSubscriptionId: "manual_grant_1",
			}),
		);
		(
			service as unknown as {
				productSettingsService: { get: () => Promise<unknown> };
			}
		).productSettingsService = {
			get: async () => ({
				organizationsEnabled: false,
				paidSubscriptionsEnabled: false,
			}),
		};

		await service.resume(user);

		expect(paymentProvider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
		expect(subscriptions.updateCancelAtPeriodEnd).toHaveBeenCalledWith(
			"manual_grant_1",
			false,
		);
	});

	it("still gates a Stripe resume behind the subscriptions switch", async () => {
		const { paymentProvider, service } = setup(
			subscriptionRow({ cancelAtPeriodEnd: true }),
		);
		(
			service as unknown as {
				productSettingsService: { get: () => Promise<unknown> };
			}
		).productSettingsService = {
			get: async () => ({
				organizationsEnabled: false,
				paidSubscriptionsEnabled: false,
			}),
		};

		await expect(service.resume(user)).rejects.toMatchObject({ status: 403 });
		expect(paymentProvider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
	});

	it("keeps manual cancellation and resume local while preserving the reason cycle", async () => {
		const { cancellationReasons, paymentProvider, service, subscriptions } =
			setup(
				subscriptionRow({
					provider: "manual",
					providerSubscriptionId: "manual_grant_1",
				}),
			);

		await service.cancel(user, { reason: "temporary_pause" });

		expect(paymentProvider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
		expect(cancellationReasons.row?.status).toBe("scheduled");
		expect(subscriptions.updateCancelAtPeriodEnd).toHaveBeenCalledWith(
			"manual_grant_1",
			true,
		);

		await service.resume(user);

		expect(paymentProvider.setCancelAtPeriodEnd).not.toHaveBeenCalled();
		expect(subscriptions.updateCancelAtPeriodEnd).toHaveBeenLastCalledWith(
			"manual_grant_1",
			false,
		);
		expect(cancellationReasons.row?.status).toBe("resumed");
	});
});

describe("BillingService manual subscription provider boundaries", () => {
	it("rejects portal, preview, and change without calling Stripe", async () => {
		const { paymentProvider, service } = setup(
			subscriptionRow({
				provider: "manual",
				providerSubscriptionId: "manual_grant_1",
			}),
		);

		await expect(service.portal(user)).rejects.toBeInstanceOf(
			ManualSubscriptionUnsupportedError,
		);
		await expect(
			service.previewChange(user, { interval: "month", tierCredits: 500 }),
		).rejects.toBeInstanceOf(ManualSubscriptionUnsupportedError);
		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).rejects.toBeInstanceOf(ManualSubscriptionUnsupportedError);

		expect(paymentProvider.createPortalSession).not.toHaveBeenCalled();
		expect(paymentProvider.previewSubscriptionChange).not.toHaveBeenCalled();
		expect(paymentProvider.changeSubscription).not.toHaveBeenCalled();
	});
});

describe("BillingService checkout attempts", () => {
	it("allows Starter on personal workspaces and rejects Business there", async () => {
		const starter = setup(null);

		await expect(
			starter.service.checkout(user, {
				interval: "month",
				plan: "starter",
				tierCredits: 60,
			}),
		).resolves.toEqual({
			url: "https://checkout.stripe.test/cs_subscription",
		});

		const business = setup(null);
		await expect(
			business.service.checkout(user, {
				interval: "month",
				plan: "business",
				tierCredits: 250,
			}),
		).rejects.toBeInstanceOf(WorkspaceNotSupportedError);
		expect(
			business.paymentProvider.createSubscriptionCheckout,
		).not.toHaveBeenCalled();
	});

	it("allows Business on org workspaces and rejects Starter there", async () => {
		const business = setup(null);
		(
			business.service as unknown as {
				productSettingsService: { get: () => Promise<unknown> };
			}
		).productSettingsService = {
			get: async () => ({ organizationsEnabled: true }),
		};

		await expect(
			business.service.checkout(
				user,
				{ interval: "month", plan: "business", tierCredits: 250 },
				orgWorkspace,
			),
		).resolves.toEqual({
			url: "https://checkout.stripe.test/cs_subscription",
		});
		expect(
			business.billingCustomerService.ensureOrgCustomer,
		).toHaveBeenCalled();

		const starter = setup(null);
		(
			starter.service as unknown as {
				productSettingsService: { get: () => Promise<unknown> };
			}
		).productSettingsService = {
			get: async () => ({ organizationsEnabled: true }),
		};
		await expect(
			starter.service.checkout(
				user,
				{ interval: "month", plan: "starter", tierCredits: 50 },
				orgWorkspace,
			),
		).rejects.toBeInstanceOf(WorkspaceNotSupportedError);
		expect(
			starter.billingCustomerService.ensureOrgCustomer,
		).not.toHaveBeenCalled();
	});

	it("rejects legacy and cross-plan tiers before creating checkout state", async () => {
		for (const request of [
			{ interval: "month", plan: "pro", tierCredits: 175 },
			{ interval: "month", plan: "starter", tierCredits: 250 },
		] as const) {
			const { checkoutAttempts, paymentProvider, service } = setup(null);

			await expect(service.checkout(user, request)).rejects.toBeInstanceOf(
				BadRequestException,
			);
			expect(checkoutAttempts.create).not.toHaveBeenCalled();
			expect(paymentProvider.createSubscriptionCheckout).not.toHaveBeenCalled();
		}
	});

	it("persists a purpose-valid subscription attempt before the provider call and attaches the same nonce", async () => {
		const { calls, checkoutAttempts, paymentProvider, service } = setup(null);

		await expect(
			service.checkout(user, {
				interval: "year",
				plan: "pro",
				tierCredits: 3000,
			}),
		).resolves.toEqual({
			url: "https://checkout.stripe.test/cs_subscription",
		});

		const created = checkoutAttempts.create.mock.calls[0]?.[0];
		expect(created).toMatchObject({
			priceLookupKey: "pro_3000_year",
			purpose: "subscription",
			userId: user.id,
		});
		expect(created).not.toHaveProperty("packId");
		expect(paymentProvider.createSubscriptionCheckout).toHaveBeenCalledWith({
			attemptId: created?.id,
			customerId: "cus_1",
			email: user.email,
			interval: "year",
			organizationId: null,
			plan: "pro",
			tierCredits: 3000,
			userId: user.id,
		});
		expect(checkoutAttempts.attachSession).toHaveBeenCalledWith(
			created?.id,
			"cs_subscription",
			checkoutAttempts.transaction,
		);
		expect(calls).toEqual([
			"create-attempt",
			"provider-subscription-checkout",
			"attach-session",
		]);
	});

	it("persists only pack identity for a top-up and passes the same attempt id to Stripe", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);

		await service.topup(user, { packId: "topup_1000" });

		const created = checkoutAttempts.create.mock.calls[0]?.[0];
		expect(created).toMatchObject({
			packId: "topup_1000",
			purpose: "topup",
			userId: user.id,
		});
		expect(created).not.toHaveProperty("priceLookupKey");
		expect(paymentProvider.createTopupCheckout).toHaveBeenCalledWith({
			attemptId: created?.id,
			credits: 1000,
			customerId: "cus_1",
			organizationId: null,
			packId: "topup_1000",
			userId: user.id,
		});
	});

	it("keeps the persisted attempt retryable when remote checkout creation is ambiguous", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);
		paymentProvider.createSubscriptionCheckout.mockRejectedValueOnce(
			new AmbiguousPaymentProviderWriteError(
				"Stripe checkout creation ended with an ambiguous write result",
				new Error("connection reset"),
			),
		);

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).rejects.toThrow("ambiguous write result");

		const attemptId = checkoutAttempts.create.mock.calls[0]?.[0].id;
		expect(
			checkoutAttempts.rows.find((row) => row.id === attemptId)?.status,
		).toBe("created");
		expect(checkoutAttempts.markExpired).not.toHaveBeenCalled();
		expect(checkoutAttempts.attachSession).not.toHaveBeenCalled();
	});

	it("expires a persisted attempt after a definite pre-session provider failure", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);
		paymentProvider.createTopupCheckout.mockRejectedValueOnce(
			new Error("price lookup key is invalid"),
		);

		await expect(service.topup(user, { packId: "topup_250" })).rejects.toThrow(
			"price lookup key is invalid",
		);

		const attemptId = checkoutAttempts.create.mock.calls[0]?.[0].id;
		expect(
			checkoutAttempts.rows.find((row) => row.id === attemptId)?.status,
		).toBe("expired");
		expect(checkoutAttempts.markExpired).toHaveBeenCalledWith(
			attemptId,
			checkoutAttempts.transaction,
		);
	});

	it("expires the remote session and local attempt when attach CAS loses", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);
		checkoutAttempts.attachSucceeds = false;

		await expect(service.topup(user, { packId: "topup_250" })).rejects.toThrow(
			"could not attach its session",
		);

		const attemptId = checkoutAttempts.create.mock.calls[0]?.[0].id;
		expect(paymentProvider.expireCheckoutSession).toHaveBeenCalledWith(
			"cs_topup",
		);
		expect(checkoutAttempts.markExpired).toHaveBeenCalledWith(
			attemptId,
			checkoutAttempts.transaction,
		);
	});

	it("returns 409 while a fresh attempt of the same purpose remains open", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);
		checkoutAttempts.rows.push(checkoutAttempt());

		let thrown: unknown;

		try {
			await service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(ConflictException);
		expect((thrown as ConflictException).getStatus()).toBe(409);
		expect((thrown as ConflictException).getResponse()).toEqual({
			code: "BILLING_CHECKOUT_PENDING",
			message: "A billing checkout is already pending",
		});
		expect(paymentProvider.createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it("expires a stale provider session before admitting its replacement", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);
		checkoutAttempts.rows.push(
			checkoutAttempt({
				createdAt: new Date(NOW.getTime() - 31 * 60 * 1000),
				providerSessionId: "cs_stale",
				status: "session_attached",
			}),
		);

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).resolves.toEqual({
			url: "https://checkout.stripe.test/cs_subscription",
		});

		expect(paymentProvider.retrieveCheckoutSession).toHaveBeenCalledWith(
			"cs_stale",
		);
		expect(paymentProvider.expireCheckoutSession).toHaveBeenCalledWith(
			"cs_stale",
		);
		expect(checkoutAttempts.rows[0]?.status).toBe("expired");
		expect(paymentProvider.createSubscriptionCheckout).toHaveBeenCalledOnce();
	});

	it("recovers and expires a session created before its attempt could attach", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);
		const orphanedAttempt = checkoutAttempt({
			createdAt: new Date(NOW.getTime() - 31 * 60 * 1000),
			providerSessionId: null,
			status: "created",
		});
		checkoutAttempts.rows.push(orphanedAttempt);
		paymentProvider.createSubscriptionCheckout.mockResolvedValueOnce({
			id: "cs_orphaned",
			url: "https://checkout.stripe.test/cs_orphaned",
		});

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).resolves.toEqual({
			url: "https://checkout.stripe.test/cs_subscription",
		});

		expect(paymentProvider.createSubscriptionCheckout).toHaveBeenNthCalledWith(
			1,
			{
				attemptId: orphanedAttempt.id,
				customerId: "cus_1",
				email: "",
				interval: "month",
				organizationId: null,
				plan: "pro",
				tierCredits: 250,
				userId: user.id,
			},
		);
		expect(paymentProvider.expireCheckoutSession).toHaveBeenCalledWith(
			"cs_orphaned",
		);
		expect(checkoutAttempts.rows[0]?.status).toBe("expired");
		expect(paymentProvider.createSubscriptionCheckout).toHaveBeenCalledTimes(2);
	});

	it("recovers and expires a stale pre-v6 legacy-tier attempt without locking checkout", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);
		const legacyAttempt = checkoutAttempt({
			createdAt: new Date(NOW.getTime() - 31 * 60 * 1000),
			priceLookupKey: "pro_175_month",
			providerSessionId: null,
			status: "created",
		});
		checkoutAttempts.rows.push(legacyAttempt);
		paymentProvider.createSubscriptionCheckout.mockResolvedValueOnce({
			id: "cs_legacy_orphaned",
			url: "https://checkout.stripe.test/cs_legacy_orphaned",
		});

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).resolves.toEqual({
			url: "https://checkout.stripe.test/cs_subscription",
		});

		expect(paymentProvider.createSubscriptionCheckout).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				attemptId: legacyAttempt.id,
				plan: "pro",
				tierCredits: 175,
			}),
		);
		expect(paymentProvider.expireCheckoutSession).toHaveBeenCalledWith(
			"cs_legacy_orphaned",
		);
		expect(checkoutAttempts.rows[0]?.status).toBe("expired");
		expect(paymentProvider.createSubscriptionCheckout).toHaveBeenCalledTimes(2);
	});

	it("can recover a persisted legacy top-up attempt without republishing its pack", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);
		const legacyAttempt = checkoutAttempt({
			createdAt: new Date(NOW.getTime() - 31 * 60 * 1000),
			packId: "topup_175",
			priceLookupKey: null,
			purpose: "topup",
		});
		checkoutAttempts.rows.push(legacyAttempt);

		await service.topup(user, { packId: "topup_250" });

		expect(paymentProvider.createTopupCheckout).toHaveBeenNthCalledWith(1, {
			attemptId: legacyAttempt.id,
			credits: 175,
			customerId: "cus_1",
			organizationId: null,
			packId: "topup_175",
			userId: user.id,
		});
		expect(paymentProvider.createTopupCheckout).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ packId: "topup_250" }),
		);
	});

	it("keeps a stale attempt fulfillable when completion wins the expiration race", async () => {
		const { checkoutAttempts, paymentProvider, service } = setup(null);
		checkoutAttempts.rows.push(
			checkoutAttempt({
				createdAt: new Date(NOW.getTime() - 31 * 60 * 1000),
				providerSessionId: "cs_completed_race",
				status: "session_attached",
			}),
		);
		paymentProvider.expireCheckoutSession.mockResolvedValueOnce("complete");

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}),
		).rejects.toBeInstanceOf(ConflictException);
		expect(checkoutAttempts.rows[0]?.status).toBe("session_attached");
		expect(checkoutAttempts.markExpired).not.toHaveBeenCalled();
	});
});

describe("BillingService subscription change intents", () => {
	it("rejects a legacy tier as a new change target", async () => {
		const { changeIntents, paymentProvider, service } = setup();

		await expect(
			service.previewChange(user, {
				interval: "month",
				tierCredits: 175,
			}),
		).rejects.toBeInstanceOf(BillingChangeIntentInvalidError);
		expect(changeIntents.create).not.toHaveBeenCalled();
		expect(paymentProvider.previewSubscriptionChange).not.toHaveBeenCalled();
	});

	it("rejects a persisted change intent targeting a legacy tier", async () => {
		const { changeIntents, paymentProvider, service } = setup();
		changeIntents.intent = changeIntent({
			targetPriceLookupKey: "pro_175_month",
		});

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).rejects.toBeInstanceOf(BillingChangeIntentInvalidError);
		expect(changeIntents.beginProviderAttempt).not.toHaveBeenCalled();
		expect(paymentProvider.changeSubscription).not.toHaveBeenCalled();
	});

	it("treats a same-price legacy-to-active move as an immediate change", async () => {
		const legacy = subscriptionRow({
			priceLookupKey: "pro_175_month",
			tierCredits: 175,
		});
		const { changeIntents, paymentProvider, service, subscriptions } =
			setup(legacy);

		const preview = await service.previewChange(user, {
			interval: "month",
			tierCredits: 250,
		});

		expect(paymentProvider.previewSubscriptionChange).toHaveBeenCalledWith(
			expect.objectContaining({
				billingCycleAnchorNow: true,
				newPriceLookupKey: "pro_250_month",
			}),
		);
		expect(preview.creditsDelta).toBe(250);

		await service.change(user, { intentId: preview.intentId });
		expect(paymentProvider.changeSubscription).toHaveBeenCalledWith(
			expect.objectContaining({ newPriceLookupKey: "pro_250_month" }),
		);
		expect(
			paymentProvider.scheduleSubscriptionDowngrade,
		).not.toHaveBeenCalled();
		expect(subscriptions.row?.pendingTierCredits).toBeNull();
		expect(changeIntents.intent?.targetPriceLookupKey).toBe("pro_250_month");
	});

	it.each([
		{ currentTier: 5250, targetTier: 10000 },
		{ currentTier: 7000, targetTier: 12500 },
	])("classifies legacy $currentTier to active $targetTier by its higher catalog price", async ({
		currentTier,
		targetTier,
	}) => {
		const legacy = subscriptionRow({
			priceLookupKey: `pro_${currentTier}_month`,
			tierCredits: currentTier as 5250 | 7000,
		});
		const { paymentProvider, service } = setup(legacy);

		const preview = await service.previewChange(user, {
			interval: "month",
			tierCredits: targetTier as 10000 | 12500,
		});

		expect(paymentProvider.previewSubscriptionChange).toHaveBeenCalledWith(
			expect.objectContaining({ billingCycleAnchorNow: true }),
		);
		await service.change(user, { intentId: preview.intentId });
		expect(paymentProvider.changeSubscription).toHaveBeenCalledOnce();
		expect(
			paymentProvider.scheduleSubscriptionDowngrade,
		).not.toHaveBeenCalled();
	});

	it("rejects attempts to cancel a scheduled v6 move from a legacy current tier", async () => {
		const legacy = subscriptionRow({
			interval: "year",
			pendingAppliedBy: "sub_sched_v6",
			pendingTierCredits: 250,
			priceLookupKey: "pro_175_year",
			tierCredits: 175,
		});
		const preview = setup(legacy);

		await expect(
			preview.service.previewChange(user, {
				interval: "year",
				tierCredits: 175,
			}),
		).rejects.toBeInstanceOf(BillingChangeIntentInvalidError);
		expect(
			preview.paymentProvider.previewSubscriptionChange,
		).not.toHaveBeenCalled();

		const execute = setup(legacy);
		execute.changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_175_year",
			targetPriceLookupKey: "pro_175_year",
		});
		await expect(
			execute.service.change(user, { intentId: INTENT_ID }),
		).rejects.toBeInstanceOf(BillingChangeIntentInvalidError);
		expect(
			execute.paymentProvider.cancelScheduledSubscriptionDowngrade,
		).not.toHaveBeenCalled();
		expect(execute.changeIntents.beginProviderAttempt).not.toHaveBeenCalled();
	});

	it("creates a fixed-proration preview intent and returns its persisted facts", async () => {
		const { changeIntents, credits, paymentProvider, service } = setup();
		// 100 credits of plan balance stay below the 500-credit target cap, so
		// the whole new allotment is the delta.
		credits.balance = { balance: 10_000, plan: 10_000, promo: 0, topup: 0 };

		const result = await service.previewChange(user, {
			interval: "month",
			tierCredits: 500,
		});

		// Ruling 7: a same-interval upgrade resets the billing anchor.
		expect(paymentProvider.previewSubscriptionChange).toHaveBeenCalledWith({
			billingCycleAnchorNow: true,
			newPriceLookupKey: "pro_500_month",
			prorationDate: PRORATION_DATE,
			providerSubscriptionId: "sub_1",
		});
		expect(changeIntents.create).toHaveBeenCalledWith({
			anchorReset: true,
			currency: "usd",
			currentPriceLookupKey: "pro_250_month",
			expiresAt: new Date("2026-08-01T12:49:56.000Z"),
			organizationId: null,
			previewTotalMinor: 2_500,
			prorationDate: PRORATION_DATE,
			status: "open",
			subscriptionId: "22222222-2222-4222-8222-222222222222",
			targetPriceLookupKey: "pro_500_month",
			userId: user.id,
		});
		expect(result).toEqual({
			amountDueMinor: 2_500,
			creditsDelta: 500,
			currency: "usd",
			expiresAt: "2026-08-01T12:49:56.000Z",
			intentId: INTENT_ID,
		});
	});

	it("quotes the capped-refill delta when the plan balance exceeds the new allotment", async () => {
		const { credits, service } = setup();
		// 620 credits on hand on the 250 tier, moving to 500: the capped-refill
		// rule quotes 380.
		credits.balance = { balance: 62_000, plan: 62_000, promo: 0, topup: 0 };

		const result = await service.previewChange(user, {
			interval: "month",
			tierCredits: 500,
		});

		expect(result.creditsDelta).toBe(380);
	});

	it("keeps downgrades and pending-downgrade cancels off the anchor reset with a zero credit delta", async () => {
		const downgrade = setup(
			subscriptionRow({ priceLookupKey: "pro_500_month", tierCredits: 500 }),
		);

		const downgradePreview = await downgrade.service.previewChange(user, {
			interval: "month",
			tierCredits: 250,
		});

		expect(
			downgrade.paymentProvider.previewSubscriptionChange,
		).toHaveBeenCalledWith(
			expect.objectContaining({ billingCycleAnchorNow: false }),
		);
		expect(downgrade.changeIntents.create).toHaveBeenCalledWith(
			expect.objectContaining({ anchorReset: false }),
		);
		expect(downgradePreview.creditsDelta).toBe(0);

		const cancel = setup(subscriptionRow({ pendingTierCredits: 250 }));
		const cancelPreview = await cancel.service.previewChange(user, {
			interval: "month",
			tierCredits: 250,
		});

		expect(
			cancel.paymentProvider.previewSubscriptionChange,
		).not.toHaveBeenCalled();
		expect(cancel.changeIntents.create).toHaveBeenCalledWith(
			expect.objectContaining({ anchorReset: false }),
		);
		expect(cancelPreview.creditsDelta).toBe(0);
	});

	it("executes with the anchor decision persisted on the intent, not recomputed state", async () => {
		const { changeIntents, paymentProvider, service } = setup();
		changeIntents.intent = changeIntent({ anchorReset: true });

		await service.change(user, { intentId: INTENT_ID });

		expect(paymentProvider.changeSubscription).toHaveBeenCalledWith(
			expect.objectContaining({ billingCycleAnchorNow: true }),
		);
	});

	it("claims, executes, and durably completes an intent with its exact proration date", async () => {
		const {
			changeIntents,
			paymentProvider,
			service,
			subscriptions,
			subscriptionSync,
		} = setup();
		changeIntents.intent = changeIntent();

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({
			outcome: "applied",
		});

		expect(changeIntents.beginProviderAttempt).toHaveBeenCalledWith(
			INTENT_ID,
			user.id,
			expect.any(Date),
			changeIntents.transaction,
		);
		expect(subscriptions.setPendingTierCredits).toHaveBeenCalledWith(
			"sub_1",
			null,
			changeIntents.transaction,
		);
		expect(paymentProvider.changeSubscription).toHaveBeenCalledWith({
			billingCycleAnchorNow: false,
			idempotencyKey: `sub-change:${user.id}:${INTENT_ID}`,
			newPriceLookupKey: "pro_500_month",
			prorationDate: PRORATION_DATE,
			providerSubscriptionId: "sub_1",
		});
		expect(changeIntents.completeProviderAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				id: INTENT_ID,
				outcome: "applied",
				userId: user.id,
			}),
			changeIntents.transaction,
		);
		expect(subscriptionSync.syncFromStripe).toHaveBeenCalledWith("cus_1");
	});

	it("rejects expired and previously used intents without calling the provider", async () => {
		const expired = setup();
		expired.changeIntents.intent = changeIntent({
			expiresAt: new Date(NOW.getTime() - 1),
		});

		await expect(
			expired.service.change(user, { intentId: INTENT_ID }),
		).rejects.toBeInstanceOf(BillingChangeIntentExpiredError);
		expect(expired.changeIntents.expireIfOpen).toHaveBeenCalledWith(
			INTENT_ID,
			expect.any(Date),
			expired.changeIntents.transaction,
		);
		expect(expired.paymentProvider.changeSubscription).not.toHaveBeenCalled();

		const used = setup();
		used.changeIntents.intent = changeIntent({ status: "consumed" });

		await expect(
			used.service.change(user, { intentId: INTENT_ID }),
		).rejects.toBeInstanceOf(BillingChangeIntentInvalidError);
		expect(used.paymentProvider.changeSubscription).not.toHaveBeenCalled();
	});

	it("treats a lost consume CAS as an invalid already-used intent", async () => {
		const { changeIntents, paymentProvider, service } = setup();
		changeIntents.intent = changeIntent();
		changeIntents.consumeSucceeds = false;

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).rejects.toBeInstanceOf(BillingChangeIntentInvalidError);
		expect(paymentProvider.changeSubscription).not.toHaveBeenCalled();
	});

	it("rechecks provider pending state before consuming the intent", async () => {
		const { changeIntents, paymentProvider, service } = setup();
		changeIntents.intent = changeIntent();
		paymentProvider.pendingUpdate = true;

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).rejects.toBeInstanceOf(SubscriptionChangePendingError);
		expect(changeIntents.beginProviderAttempt).not.toHaveBeenCalled();
		expect(paymentProvider.changeSubscription).not.toHaveBeenCalled();
	});

	it("keeps an ambiguous provider attempt processing and replays its key despite Stripe pending state", async () => {
		const { changeIntents, paymentProvider, service } = setup();
		changeIntents.intent = changeIntent();
		paymentProvider.changeSubscription.mockRejectedValueOnce(
			new AmbiguousPaymentProviderWriteError(
				"Stripe timeout after write",
				new Error("connection reset"),
			),
		);

		await expect(service.change(user, { intentId: INTENT_ID })).rejects.toThrow(
			"Stripe timeout after write",
		);
		expect(changeIntents.intent?.status).toBe("processing");
		paymentProvider.pendingUpdate = true;

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({ outcome: "applied" });
		expect(paymentProvider.changeSubscription).toHaveBeenCalledTimes(2);
		expect(
			paymentProvider.changeSubscription.mock.calls.map(
				([params]) => params.idempotencyKey,
			),
		).toEqual([
			`sub-change:${user.id}:${INTENT_ID}`,
			`sub-change:${user.id}:${INTENT_ID}`,
		]);
	});

	it("consumes and replays a definite provider failure without retrying the write", async () => {
		const errorLog = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const { changeIntents, paymentProvider, service, subscriptionSync } =
			setup();
		changeIntents.intent = changeIntent();
		paymentProvider.changeSubscription.mockRejectedValueOnce(
			new Error("Stripe rejected the update parameters"),
		);

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({ outcome: "failed" });
		expect(changeIntents.intent).toMatchObject({
			providerOutcome: "failed",
			status: "consumed",
		});
		expect(subscriptionSync.syncFromStripe).not.toHaveBeenCalled();
		expect(errorLog).toHaveBeenCalledWith(
			expect.stringContaining("ended in a definite provider failure"),
			expect.any(String),
		);

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({ outcome: "failed" });
		expect(paymentProvider.changeSubscription).toHaveBeenCalledOnce();
	});

	it("replays a consumed payment-required result and hosted invoice after response loss", async () => {
		const { changeIntents, credits, paymentProvider, service } = setup();
		const pendingExpiresAt = new Date("2026-08-01T13:34:56.000Z");
		changeIntents.intent = changeIntent();
		paymentProvider.changeSubscription.mockResolvedValueOnce({
			hostedInvoiceUrl: "https://invoice.stripe.test/in_1",
			outcome: "payment_required",
			pendingExpiresAt,
		});
		credits.getSettledBalance.mockRejectedValueOnce(
			new Error("response view unavailable"),
		);

		await expect(service.change(user, { intentId: INTENT_ID })).rejects.toThrow(
			"response view unavailable",
		);
		expect(changeIntents.intent).toMatchObject({
			providerHostedInvoiceUrl: "https://invoice.stripe.test/in_1",
			providerOutcome: "payment_required",
			providerPendingExpiresAt: pendingExpiresAt,
			status: "consumed",
		});

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({
			hostedInvoiceUrl: "https://invoice.stripe.test/in_1",
			outcome: "payment_required",
			pendingExpiresAt: pendingExpiresAt.toISOString(),
		});
		expect(paymentProvider.changeSubscription).toHaveBeenCalledOnce();
	});

	it("replays a consumed applied result after response view loss", async () => {
		const {
			changeIntents,
			credits,
			paymentProvider,
			service,
			subscriptionSync,
		} = setup();
		changeIntents.intent = changeIntent();
		credits.getSettledBalance.mockRejectedValueOnce(
			new Error("response view unavailable"),
		);

		await expect(service.change(user, { intentId: INTENT_ID })).rejects.toThrow(
			"response view unavailable",
		);
		expect(changeIntents.intent).toMatchObject({
			providerOutcome: "applied",
			status: "consumed",
		});

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({ outcome: "applied" });
		expect(paymentProvider.changeSubscription).toHaveBeenCalledOnce();
		expect(subscriptionSync.syncFromStripe).toHaveBeenCalledTimes(2);
	});

	it("schedules a downgrade remotely without changing the live subscription item", async () => {
		const current = subscriptionRow({
			priceLookupKey: "pro_500_month",
			tierCredits: 500,
		});
		const { changeIntents, paymentProvider, service, subscriptions } =
			setup(current);
		changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_500_month",
			targetPriceLookupKey: "pro_250_month",
		});

		const result = await service.change(user, { intentId: INTENT_ID });

		expect(subscriptions.setPendingTierCredits).toHaveBeenCalledWith(
			"sub_1",
			250,
			changeIntents.transaction,
			{ plan: "pro", interval: "month" },
		);
		expect(paymentProvider.scheduleSubscriptionDowngrade).toHaveBeenCalledWith({
			allowSameIntentRecovery: true,
			currentPriceLookupKey: "pro_500_month",
			expectedScheduleTarget: null,
			idempotencyKey: `sub-change:${user.id}:${INTENT_ID}`,
			newPriceLookupKey: "pro_250_month",
			providerSubscriptionId: "sub_1",
		});
		expect(subscriptions.markPendingTierApplied).toHaveBeenCalledWith(
			"sub_1",
			"sub_sched_1",
			changeIntents.transaction,
		);
		expect(paymentProvider.changeSubscription).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			outcome: "applied",
			subscription: { pendingTierCredits: 250, tierCredits: 500 },
		});
	});

	it.each([
		["month", "month"],
		["month", "year"],
		["year", "year"],
	] as const)("keeps Pro %s paid benefits until the scheduled Starter %s renewal", async (currentInterval, targetInterval) => {
		const current = subscriptionRow({
			interval: currentInterval,
			priceLookupKey: `pro_250_${currentInterval}`,
		});
		const { service, paymentProvider, subscriptions, changeIntents, credits } =
			setup(current);
		// A fully spent Pro allotment must not make the cheaper annual plan an
		// immediate prorated refund or a fresh allotment to spend again.
		credits.balance.plan = 0;
		const preview = await service.previewChange(user, {
			plan: "starter",
			tierCredits: 60,
			interval: targetInterval,
		});
		expect(preview).toMatchObject({ amountDueMinor: 0, creditsDelta: 0 });
		expect(changeIntents.intent?.anchorReset).toBe(false);
		const result = await service.change(user, { intentId: preview.intentId });
		expect(paymentProvider.changeSubscription).not.toHaveBeenCalled();
		expect(paymentProvider.scheduleSubscriptionDowngrade).toHaveBeenCalledWith(
			expect.objectContaining({
				currentPriceLookupKey: `pro_250_${currentInterval}`,
				newPriceLookupKey: `starter_60_${targetInterval}`,
			}),
		);
		expect(result.subscription).toMatchObject({
			plan: "pro",
			tierCredits: 250,
			interval: currentInterval,
			pendingPlan: "starter",
			pendingTierCredits: 60,
			pendingInterval: targetInterval,
		});
		expect(subscriptions.row?.currentPeriodEnd).toEqual(
			current.currentPeriodEnd,
		);
		await service.change(user, { intentId: preview.intentId });
		expect(
			paymentProvider.scheduleSubscriptionDowngrade,
		).toHaveBeenCalledOnce();
	});

	it("replaces a pending Starter yearly downgrade using its complete Stripe target", async () => {
		const { service, paymentProvider, subscriptions } = setup(
			subscriptionRow({
				priceLookupKey: "pro_500_month",
				tierCredits: 500,
				pendingPlan: "starter",
				pendingTierCredits: 60,
				pendingInterval: "year",
				pendingAppliedBy: "sub_sched_1",
			}),
		);
		const preview = await service.previewChange(user, {
			plan: "pro",
			tierCredits: 250,
			interval: "month",
		});
		await service.change(user, { intentId: preview.intentId });
		expect(paymentProvider.scheduleSubscriptionDowngrade).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedScheduleTarget: "starter_60_year",
				newPriceLookupKey: "pro_250_month",
			}),
		);
		expect(subscriptions.row).toMatchObject({
			pendingPlan: "pro",
			pendingTierCredits: 250,
			pendingInterval: "month",
			tierCredits: 500,
		});
	});

	it("cancels a Starter downgrade without granting credits or starting a new Pro cycle", async () => {
		const { service, paymentProvider, subscriptions } = setup(
			subscriptionRow({
				pendingPlan: "starter",
				pendingTierCredits: 60,
				pendingInterval: "year",
				pendingAppliedBy: "sub_sched_1",
			}),
		);
		const preview = await service.previewChange(user, {
			plan: "pro",
			tierCredits: 250,
			interval: "month",
		});
		expect(preview).toMatchObject({ amountDueMinor: 0, creditsDelta: 0 });
		await service.change(user, { intentId: preview.intentId });
		expect(
			paymentProvider.cancelScheduledSubscriptionDowngrade,
		).toHaveBeenCalledOnce();
		expect(paymentProvider.changeSubscription).not.toHaveBeenCalled();
		expect(subscriptions.row).toMatchObject({
			plan: "pro",
			tierCredits: 250,
			pendingPlan: null,
			pendingTierCredits: null,
			pendingInterval: null,
		});
	});

	it("blocks a second Starter checkout while Pro is active or scheduled to end", async () => {
		for (const cancelAtPeriodEnd of [false, true]) {
			const { service, paymentProvider } = setup(
				subscriptionRow({ cancelAtPeriodEnd }),
			);
			await expect(
				service.checkout(user, {
					plan: "starter",
					tierCredits: 60,
					interval: "month",
				}),
			).rejects.toThrow();
			expect(paymentProvider.createSubscriptionCheckout).not.toHaveBeenCalled();
		}
	});

	it("does not restore a voluntary Starter downgrade as a legacy Pro migration after a failed upgrade", async () => {
		const { service, paymentProvider, subscriptions } = setup(
			subscriptionRow({
				priceLookupKey: "pro_175_month",
				tierCredits: 175,
				pendingPlan: "starter",
				pendingTierCredits: 60,
				pendingInterval: "year",
				pendingAppliedBy: "sub_sched_1",
			}),
		);
		paymentProvider.changeSubscription.mockResolvedValueOnce({
			outcome: "failed",
		});
		const preview = await service.previewChange(user, {
			plan: "pro",
			tierCredits: 500,
			interval: "month",
		});
		await expect(
			service.change(user, { intentId: preview.intentId }),
		).resolves.toMatchObject({ outcome: "failed" });
		expect(
			paymentProvider.scheduleSubscriptionDowngrade,
		).not.toHaveBeenCalled();
		expect(subscriptions.row).toMatchObject({
			pendingPlan: null,
			pendingTierCredits: null,
			pendingInterval: null,
		});
	});

	it("clears the released Starter target when canceling Pro at period end", async () => {
		const { service, subscriptions } = setup(
			subscriptionRow({
				pendingPlan: "starter",
				pendingTierCredits: 60,
				pendingInterval: "year",
				pendingAppliedBy: "sub_sched_1",
			}),
		);
		await service.cancel(user, { reason: "too_expensive" });
		expect(subscriptions.row).toMatchObject({
			plan: "pro",
			tierCredits: 250,
			cancelAtPeriodEnd: true,
			pendingPlan: null,
			pendingTierCredits: null,
			pendingInterval: null,
			pendingAppliedBy: null,
		});
	});

	it("clears a scheduled downgrade before applying an upgrade", async () => {
		const current = subscriptionRow({
			pendingAppliedBy: "sub_sched_1",
			pendingTierCredits: 250,
			priceLookupKey: "pro_500_month",
			tierCredits: 500,
		});
		const { changeIntents, paymentProvider, service, subscriptions } =
			setup(current);
		changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_500_month",
			targetPriceLookupKey: "pro_1000_month",
		});

		await service.change(user, { intentId: INTENT_ID });

		expect(
			paymentProvider.cancelScheduledSubscriptionDowngrade,
		).toHaveBeenCalledWith(
			"sub_1",
			`sub-change:${user.id}:${INTENT_ID}:release-schedule`,
		);
		expect(subscriptions.setPendingTierCredits).toHaveBeenCalledWith(
			"sub_1",
			null,
			changeIntents.transaction,
		);
		expect(paymentProvider.changeSubscription).toHaveBeenCalledOnce();
		expect(
			paymentProvider.cancelScheduledSubscriptionDowngrade.mock
				.invocationCallOrder[0],
		).toBeLessThan(
			paymentProvider.changeSubscription.mock.invocationCallOrder[0] ?? 0,
		);
		expect(subscriptions.row?.pendingTierCredits).toBeNull();
	});

	it("does not restore a released v6 schedule after a successful legacy-tier upgrade", async () => {
		const current = subscriptionRow({
			interval: "year",
			pendingAppliedBy: "sub_sched_v6",
			pendingTierCredits: 250,
			priceLookupKey: "pro_175_year",
			tierCredits: 175,
		});
		const { changeIntents, paymentProvider, service, subscriptions } =
			setup(current);
		changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_175_year",
			targetPriceLookupKey: "pro_500_year",
		});

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({
			outcome: "applied",
			subscription: { pendingTierCredits: null, tierCredits: 175 },
		});
		expect(
			paymentProvider.cancelScheduledSubscriptionDowngrade,
		).toHaveBeenCalledOnce();
		expect(paymentProvider.changeSubscription).toHaveBeenCalledOnce();
		expect(
			paymentProvider.scheduleSubscriptionDowngrade,
		).not.toHaveBeenCalled();
		expect(subscriptions.row).toMatchObject({
			pendingAppliedBy: null,
			pendingTierCredits: null,
		});
	});

	it("restores a released v6 schedule after a legacy-tier upgrade fails", async () => {
		const errorLog = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const current = subscriptionRow({
			interval: "year",
			pendingAppliedBy: "sub_sched_v6",
			pendingTierCredits: 250,
			priceLookupKey: "pro_175_year",
			tierCredits: 175,
		});
		const { changeIntents, paymentProvider, service, subscriptions } =
			setup(current);
		changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_175_year",
			targetPriceLookupKey: "pro_500_year",
		});
		paymentProvider.changeSubscription.mockRejectedValueOnce(
			new Error("Stripe rejected the legacy-tier upgrade"),
		);
		paymentProvider.scheduleSubscriptionDowngrade.mockResolvedValueOnce(
			"sub_sched_v6_restored",
		);

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({
			outcome: "failed",
			subscription: { pendingTierCredits: 250, tierCredits: 175 },
		});
		expect(paymentProvider.scheduleSubscriptionDowngrade).toHaveBeenCalledWith({
			allowSameIntentRecovery: true,
			currentPriceLookupKey: "pro_175_year",
			expectedScheduleTarget: null,
			idempotencyKey: `sub-change:${user.id}:${INTENT_ID}:restore-schedule`,
			newPriceLookupKey: "pro_250_year",
			providerSubscriptionId: "sub_1",
		});
		expect(subscriptions.setPendingTierCredits).toHaveBeenNthCalledWith(
			1,
			"sub_1",
			250,
			changeIntents.transaction,
		);
		expect(subscriptions.setPendingTierCredits).toHaveBeenNthCalledWith(
			2,
			"sub_1",
			250,
			changeIntents.transaction,
		);
		expect(subscriptions.markPendingTierApplied).toHaveBeenCalledWith(
			"sub_1",
			"sub_sched_v6_restored",
			changeIntents.transaction,
		);
		expect(subscriptions.row).toMatchObject({
			pendingAppliedBy: "sub_sched_v6_restored",
			pendingTierCredits: 250,
		});
		expect(changeIntents.intent).toMatchObject({
			providerOutcome: "failed",
			status: "consumed",
		});
		expect(errorLog).toHaveBeenCalledOnce();

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({ outcome: "failed" });
		expect(
			paymentProvider.scheduleSubscriptionDowngrade,
		).toHaveBeenCalledOnce();
	});

	it("restores a released v6 schedule when the local release step throws", async () => {
		const current = subscriptionRow({
			interval: "year",
			pendingAppliedBy: "sub_sched_v6",
			pendingTierCredits: 250,
			priceLookupKey: "pro_175_year",
			tierCredits: 175,
		});
		const { changeIntents, paymentProvider, service, subscriptions } =
			setup(current);
		const persistenceError = new Error("local pending release failed");
		changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_175_year",
			targetPriceLookupKey: "pro_500_year",
		});
		subscriptions.setPendingTierCredits.mockRejectedValueOnce(persistenceError);
		paymentProvider.scheduleSubscriptionDowngrade.mockResolvedValueOnce(
			"sub_sched_v6_restored",
		);

		await expect(service.change(user, { intentId: INTENT_ID })).rejects.toBe(
			persistenceError,
		);
		expect(paymentProvider.changeSubscription).not.toHaveBeenCalled();
		expect(paymentProvider.scheduleSubscriptionDowngrade).toHaveBeenCalledWith({
			allowSameIntentRecovery: true,
			currentPriceLookupKey: "pro_175_year",
			expectedScheduleTarget: null,
			idempotencyKey: `sub-change:${user.id}:${INTENT_ID}:restore-schedule`,
			newPriceLookupKey: "pro_250_year",
			providerSubscriptionId: "sub_1",
		});
		expect(subscriptions.row).toMatchObject({
			pendingAppliedBy: "sub_sched_v6_restored",
			pendingTierCredits: 250,
		});
		expect(changeIntents.intent?.status).toBe("processing");
	});

	it("retains the v6 target across a failed compensation and retry", async () => {
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
		const current = subscriptionRow({
			interval: "year",
			pendingAppliedBy: "sub_sched_v6",
			pendingTierCredits: 250,
			priceLookupKey: "pro_175_year",
			tierCredits: 175,
		});
		const { changeIntents, paymentProvider, service, subscriptions } =
			setup(current);
		changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_175_year",
			targetPriceLookupKey: "pro_500_year",
		});
		paymentProvider.changeSubscription
			.mockRejectedValueOnce(new Error("first upgrade rejection"))
			.mockRejectedValueOnce(new Error("replayed upgrade rejection"));
		paymentProvider.scheduleSubscriptionDowngrade
			.mockRejectedValueOnce(new Error("schedule temporarily unavailable"))
			.mockResolvedValueOnce("sub_sched_v6_restored");

		await expect(service.change(user, { intentId: INTENT_ID })).rejects.toThrow(
			"schedule temporarily unavailable",
		);
		expect(changeIntents.intent?.status).toBe("processing");
		expect(subscriptions.row).toMatchObject({
			pendingAppliedBy: null,
			pendingTierCredits: 250,
		});

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({
			outcome: "failed",
			subscription: {
				pendingTierCredits: 250,
			},
		});
		expect(subscriptions.row?.pendingAppliedBy).toBe("sub_sched_v6_restored");
		expect(paymentProvider.changeSubscription).toHaveBeenCalledTimes(2);
		expect(paymentProvider.scheduleSubscriptionDowngrade).toHaveBeenCalledTimes(
			2,
		);
		expect(
			paymentProvider.scheduleSubscriptionDowngrade.mock.calls.map(
				([params]) => params.idempotencyKey,
			),
		).toEqual([
			`sub-change:${user.id}:${INTENT_ID}:restore-schedule`,
			`sub-change:${user.id}:${INTENT_ID}:restore-schedule`,
		]);
	});

	it("retries after remote restoration succeeds but local marking fails", async () => {
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
		const current = subscriptionRow({
			interval: "year",
			pendingAppliedBy: "sub_sched_v6",
			pendingTierCredits: 250,
			priceLookupKey: "pro_175_year",
			tierCredits: 175,
		});
		const { changeIntents, paymentProvider, service, subscriptions } =
			setup(current);
		changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_175_year",
			targetPriceLookupKey: "pro_500_year",
		});
		paymentProvider.changeSubscription
			.mockRejectedValueOnce(new Error("first upgrade rejection"))
			.mockRejectedValueOnce(new Error("replayed upgrade rejection"));
		paymentProvider.scheduleSubscriptionDowngrade
			.mockResolvedValueOnce("sub_sched_restore_first")
			.mockResolvedValueOnce("sub_sched_restore_retry");
		subscriptions.markPendingTierApplied.mockRejectedValueOnce(
			new Error("schedule marker persistence unavailable"),
		);

		await expect(service.change(user, { intentId: INTENT_ID })).rejects.toThrow(
			"schedule marker persistence unavailable",
		);
		expect(subscriptions.row).toMatchObject({
			pendingAppliedBy: null,
			pendingTierCredits: 250,
		});
		expect(changeIntents.intent?.status).toBe("processing");

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({
			outcome: "failed",
			subscription: { pendingTierCredits: 250 },
		});
		expect(subscriptions.row).toMatchObject({
			pendingAppliedBy: "sub_sched_restore_retry",
			pendingTierCredits: 250,
		});
		expect(
			paymentProvider.cancelScheduledSubscriptionDowngrade,
		).toHaveBeenCalledTimes(2);
		expect(
			paymentProvider.cancelScheduledSubscriptionDowngrade.mock.calls,
		).toEqual([
			["sub_1", `sub-change:${user.id}:${INTENT_ID}:release-schedule`],
			["sub_1", `sub-change:${user.id}:${INTENT_ID}:release-schedule`],
		]);
	});

	it("keeps the released downgrade cleared when the subsequent upgrade is definitely rejected", async () => {
		const errorLog = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const current = subscriptionRow({
			pendingAppliedBy: "sub_sched_1",
			pendingTierCredits: 250,
			priceLookupKey: "pro_500_month",
			tierCredits: 500,
		});
		const { changeIntents, paymentProvider, service, subscriptions } =
			setup(current);
		changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_500_month",
			targetPriceLookupKey: "pro_1000_month",
		});
		paymentProvider.changeSubscription.mockRejectedValueOnce(
			new Error("Stripe rejected the price update"),
		);

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({
			outcome: "failed",
			subscription: { pendingTierCredits: null, tierCredits: 500 },
		});
		expect(
			paymentProvider.cancelScheduledSubscriptionDowngrade,
		).toHaveBeenCalledOnce();
		expect(paymentProvider.changeSubscription).toHaveBeenCalledOnce();
		expect(subscriptions.row).toMatchObject({
			pendingAppliedBy: null,
			pendingTierCredits: null,
		});
		expect(changeIntents.intent).toMatchObject({
			providerOutcome: "failed",
			status: "consumed",
		});
		expect(errorLog).toHaveBeenCalledOnce();

		await expect(
			service.change(user, { intentId: INTENT_ID }),
		).resolves.toMatchObject({ outcome: "failed" });
		expect(
			paymentProvider.cancelScheduledSubscriptionDowngrade,
		).toHaveBeenCalledOnce();
		expect(paymentProvider.changeSubscription).toHaveBeenCalledOnce();
	});

	it("cancels a pending downgrade when the user selects the still-live current tier", async () => {
		const current = subscriptionRow({
			pendingAppliedBy: "sub_sched_1",
			pendingTierCredits: 250,
			priceLookupKey: "pro_500_month",
			tierCredits: 500,
		});
		const { paymentProvider, service, subscriptions } = setup(current);

		const preview = await service.previewChange(user, {
			interval: "month",
			tierCredits: 500,
		});
		expect(preview.amountDueMinor).toBe(0);
		expect(paymentProvider.previewSubscriptionChange).not.toHaveBeenCalled();

		await expect(
			service.change(user, { intentId: preview.intentId }),
		).resolves.toMatchObject({
			subscription: { pendingTierCredits: null, tierCredits: 500 },
		});
		expect(
			paymentProvider.cancelScheduledSubscriptionDowngrade,
		).toHaveBeenCalledWith(
			"sub_1",
			`sub-change:${user.id}:${INTENT_ID}:cancel-schedule`,
		);
		expect(paymentProvider.changeSubscription).not.toHaveBeenCalled();
		expect(subscriptions.row?.pendingTierCredits).toBeNull();
	});

	it("rejects yearly to monthly at preview and again when consuming a forged intent", async () => {
		const yearly = subscriptionRow({
			interval: "year",
			priceLookupKey: "pro_250_year",
		});
		const preview = setup(yearly);

		await expect(
			preview.service.previewChange(user, {
				interval: "month",
				tierCredits: 250,
			}),
		).rejects.toBeInstanceOf(YearlyToMonthlyUnsupportedError);
		expect(
			preview.paymentProvider.previewSubscriptionChange,
		).not.toHaveBeenCalled();

		const change = setup(yearly);
		change.changeIntents.intent = changeIntent({
			currentPriceLookupKey: "pro_250_year",
			targetPriceLookupKey: "pro_250_month",
		});

		await expect(
			change.service.change(user, { intentId: INTENT_ID }),
		).rejects.toBeInstanceOf(YearlyToMonthlyUnsupportedError);
		expect(change.changeIntents.beginProviderAttempt).not.toHaveBeenCalled();
	});
});
