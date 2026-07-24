import type { AuthUser } from "@wandit/auth";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import { BillingNotConfiguredError } from "../../domain/errors/billing-not-configured.error";
import { PaymentPastDueError } from "../../domain/errors/payment-past-due.error";
import type { PaymentProvider } from "../../domain/ports/payment-provider.port";
import type {
	BillingCustomerRow,
	BillingCustomersRepository,
	BillingCustomersTransaction,
} from "../../infrastructure/persistence/billing-customers.repository";
import type {
	SubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";
import { BillingService } from "./billing.service";
import type { BillingCustomerService } from "./billing-customer.service";
import type { StripeSubscriptionSyncService } from "./stripe-subscription-sync.service";

const user = {
	email: "user@example.com",
	id: "user_1",
} as AuthUser;

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
		plan: "pro",
		priceLookupKey: "pro_100_month",
		provider: "stripe",
		providerSubscriptionId: "sub_1",
		status: "active",
		tierCredits: 100,
		updatedAt: new Date("2026-07-24T10:00:00.000Z"),
		userId: user.id,
		...overrides,
	};
}

class FakeBillingCustomersRepository {
	readonly transaction = {} as BillingCustomersTransaction;
	customer: BillingCustomerRow | null = billingCustomer();
	private readonly lockTails = new Map<string, Promise<void>>();

	findByUserId = vi.fn(
		async (_userId: string, _client?: BillingCustomersTransaction) =>
			this.customer,
	);
	setOpenCheckoutSessionId = vi.fn(
		async (
			_userId: string,
			openCheckoutSessionId: string,
			_client?: BillingCustomersTransaction,
		) => {
			if (!this.customer) {
				throw new Error("Missing billing customer");
			}

			this.customer = {
				...this.customer,
				openCheckoutSessionId,
			};

			return this.customer;
		},
	);

	withUserLock<T>(
		userId: string,
		fn: (tx: BillingCustomersTransaction) => Promise<T>,
	): Promise<T> {
		const previous = this.lockTails.get(userId) ?? Promise.resolve();
		const result = previous.then(() => fn(this.transaction));
		this.lockTails.set(
			userId,
			result.then(
				() => undefined,
				() => undefined,
			),
		);

		return result;
	}
}

class FakeSubscriptionsRepository {
	row: SubscriptionRow | null;
	findActiveByUserId = vi.fn(async (_userId: string) => this.row);
	updateCancelAtPeriodEnd = vi.fn();

	constructor(row: SubscriptionRow | null) {
		this.row = row;
	}
}

class FakeCreditsService {
	balance = { balance: 0, plan: 0, topup: 0 };
	getBalance = vi.fn(async (_userId: string) => this.balance);
}

class FakePaymentProvider {
	private checkoutCounter = 0;
	subscriptions: Stripe.Subscription[] = [];

	changeSubscription = vi.fn(
		async (_providerSubscriptionId: string, _lookupKey: string) => undefined,
	);
	createSubscriptionCheckout = vi.fn(async () => {
		this.checkoutCounter += 1;

		return {
			id: `cs_${this.checkoutCounter}`,
			url: `https://checkout.stripe.test/cs_${this.checkoutCounter}`,
		};
	});
	expireCheckoutSession = vi.fn(async (_sessionId: string) => undefined);
	listSubscriptionsForCustomer = vi.fn(
		async (_providerCustomerId: string) => this.subscriptions,
	);
	setCancelAtPeriodEnd = vi.fn();
}

class FakeBillingCustomerService {
	customer = billingCustomer();
	ensureCustomer = vi.fn(async (_user: AuthUser) => this.customer);
}

class FakeSubscriptionSyncService {
	syncFromStripe = vi.fn(
		async (_providerCustomerId: string): Promise<SubscriptionRow[]> => [],
	);
}

function setup(row: SubscriptionRow | null = subscriptionRow()) {
	const billingCustomers = new FakeBillingCustomersRepository();
	const subscriptions = new FakeSubscriptionsRepository(row);
	const credits = new FakeCreditsService();
	const paymentProvider = new FakePaymentProvider();
	const billingCustomerService = new FakeBillingCustomerService();
	const subscriptionSync = new FakeSubscriptionSyncService();
	const service = new BillingService(
		billingCustomers as unknown as BillingCustomersRepository,
		subscriptions as unknown as SubscriptionsRepository,
		credits as unknown as CreditsService,
		paymentProvider as unknown as PaymentProvider,
		billingCustomerService as unknown as BillingCustomerService,
		subscriptionSync as unknown as StripeSubscriptionSyncService,
	);

	return {
		billingCustomers,
		billingCustomerService,
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
	return {
		created: 100,
		id,
		status,
	} as Stripe.Subscription;
}

describe("BillingService", () => {
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
			balance: { balance: 0, plan: 0, topup: 0 },
			subscription: {
				entitled: false,
				status: "past_due",
			},
		});
	});

	it("rejects local entitled subscriptions before creating a checkout", async () => {
		const { billingCustomerService, paymentProvider, service } = setup();

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 100,
			}),
		).rejects.toBeInstanceOf(ActiveSubscriptionExistsError);
		expect(billingCustomerService.ensureCustomer).not.toHaveBeenCalled();
		expect(paymentProvider.createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it("returns a distinct portal-directed error for a local past_due subscription", async () => {
		const { billingCustomerService, paymentProvider, service } = setup(
			subscriptionRow({ status: "past_due" }),
		);

		let thrown: unknown;

		try {
			await service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 100,
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(PaymentPastDueError);
		expect((thrown as PaymentPastDueError).getStatus()).toBe(409);
		expect((thrown as PaymentPastDueError).getResponse()).toEqual({
			code: "PAYMENT_PAST_DUE",
			message:
				"Your subscription payment needs attention. Update it in the billing portal.",
		});
		expect(billingCustomerService.ensureCustomer).not.toHaveBeenCalled();
		expect(paymentProvider.createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it("checks Stripe and blocks a remote non-terminal subscription missing from the local mirror", async () => {
		const { paymentProvider, service } = setup(null);
		paymentProvider.subscriptions = [stripeSubscription("active")];

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 100,
			}),
		).rejects.toBeInstanceOf(ActiveSubscriptionExistsError);
		expect(paymentProvider.listSubscriptionsForCustomer).toHaveBeenCalledWith(
			"cus_1",
		);
		expect(paymentProvider.createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it("maps remote non-entitled blockers to the payment-attention error", async () => {
		const { paymentProvider, service } = setup(null);
		paymentProvider.subscriptions = [stripeSubscription("past_due")];

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 100,
			}),
		).rejects.toBeInstanceOf(PaymentPastDueError);
		expect(paymentProvider.createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it.each([
		"incomplete",
		"unpaid",
		"paused",
	] as const)("keeps the existing subscription-conflict error for remote %s subscriptions", async (status) => {
		const { paymentProvider, service } = setup(null);
		paymentProvider.subscriptions = [stripeSubscription(status)];

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 100,
			}),
		).rejects.toBeInstanceOf(ActiveSubscriptionExistsError);
		expect(paymentProvider.createSubscriptionCheckout).not.toHaveBeenCalled();
	});

	it("expires the stored attempt before persisting a replacement checkout", async () => {
		const { billingCustomers, paymentProvider, service } = setup(null);
		billingCustomers.customer = billingCustomer();
		billingCustomers.customer.openCheckoutSessionId = "cs_old";

		await expect(
			service.checkout(user, {
				interval: "year",
				plan: "business",
				tierCredits: 1200,
			}),
		).resolves.toEqual({
			url: "https://checkout.stripe.test/cs_1",
		});

		expect(paymentProvider.expireCheckoutSession).toHaveBeenCalledWith(
			"cs_old",
		);
		expect(paymentProvider.createSubscriptionCheckout).toHaveBeenCalledWith({
			customerId: "cus_1",
			email: user.email,
			interval: "year",
			plan: "business",
			tierCredits: 1200,
			userId: user.id,
		});
		expect(billingCustomers.setOpenCheckoutSessionId).toHaveBeenCalledWith(
			user.id,
			"cs_1",
			billingCustomers.transaction,
		);
		expect(billingCustomers.customer.openCheckoutSessionId).toBe("cs_1");
	});

	it("expires a newly created checkout when its database reference cannot be persisted", async () => {
		const { billingCustomers, paymentProvider, service } = setup(null);
		const persistenceError = new Error("database commit failed");
		billingCustomers.setOpenCheckoutSessionId.mockRejectedValueOnce(
			persistenceError,
		);

		await expect(
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 100,
			}),
		).rejects.toBe(persistenceError);

		expect(paymentProvider.createSubscriptionCheckout).toHaveBeenCalledOnce();
		expect(paymentProvider.expireCheckoutSession).toHaveBeenCalledOnce();
		expect(paymentProvider.expireCheckoutSession).toHaveBeenCalledWith("cs_1");
		expect(billingCustomers.customer?.openCheckoutSessionId).toBeNull();
	});

	it("serializes concurrent attempts so the later checkout expires the earlier one", async () => {
		const { billingCustomers, paymentProvider, service } = setup(null);

		const [first, second] = await Promise.all([
			service.checkout(user, {
				interval: "month",
				plan: "pro",
				tierCredits: 100,
			}),
			service.checkout(user, {
				interval: "year",
				plan: "business",
				tierCredits: 200,
			}),
		]);

		expect(first.url).toBe("https://checkout.stripe.test/cs_1");
		expect(second.url).toBe("https://checkout.stripe.test/cs_2");
		expect(paymentProvider.expireCheckoutSession).toHaveBeenCalledOnce();
		expect(paymentProvider.expireCheckoutSession).toHaveBeenCalledWith("cs_1");
		expect(billingCustomers.customer?.openCheckoutSessionId).toBe("cs_2");
	});

	it("switches plans, synchronizes Stripe, then builds the fresh response", async () => {
		const {
			credits,
			paymentProvider,
			service,
			subscriptions,
			subscriptionSync,
		} = setup();
		const calls: string[] = [];
		subscriptions.findActiveByUserId.mockImplementation(async () => {
			calls.push("find-subscription");
			return subscriptions.row;
		});
		credits.getBalance.mockImplementation(async () => {
			calls.push("get-balance");
			return credits.balance;
		});
		paymentProvider.changeSubscription.mockImplementation(async () => {
			calls.push("change");
		});
		subscriptionSync.syncFromStripe.mockImplementation(async () => {
			calls.push("sync");
			subscriptions.row = subscriptionRow({
				interval: "year",
				plan: "business",
				priceLookupKey: "business_1200_year",
				tierCredits: 1200,
			});

			return [subscriptions.row];
		});

		const result = await service.change(user, {
			interval: "year",
			plan: "business",
			tierCredits: 1200,
		});

		expect(paymentProvider.changeSubscription).toHaveBeenCalledWith(
			"sub_1",
			"business_1200_year",
		);
		expect(subscriptionSync.syncFromStripe).toHaveBeenCalledWith("cus_1");
		expect(calls).toEqual([
			"find-subscription",
			"change",
			"sync",
			"find-subscription",
			"get-balance",
		]);
		expect(result.subscription).toMatchObject({
			interval: "year",
			plan: "business",
			priceLookupKey: "business_1200_year",
			tierCredits: 1200,
		});
	});

	it("preserves the current plan when change omits plan", async () => {
		const { paymentProvider, service } = setup();

		await service.change(user, {
			interval: "year",
			tierCredits: 400,
		});

		expect(paymentProvider.changeSubscription).toHaveBeenCalledWith(
			"sub_1",
			"pro_400_year",
		);
	});

	it("returns the local view without Stripe when sync has no customer", async () => {
		const { billingCustomers, service, subscriptionSync } = setup();
		billingCustomers.customer = null;

		const result = await service.sync(user);

		expect(subscriptionSync.syncFromStripe).not.toHaveBeenCalled();
		expect(result.subscription).toMatchObject({ status: "active" });
	});

	it("returns the local view when Stripe billing is not configured", async () => {
		const { service, subscriptionSync } = setup();
		subscriptionSync.syncFromStripe.mockRejectedValueOnce(
			new BillingNotConfiguredError("STRIPE_SECRET_KEY"),
		);

		const result = await service.sync(user);

		expect(subscriptionSync.syncFromStripe).toHaveBeenCalledWith("cus_1");
		expect(result.subscription).toMatchObject({ status: "active" });
	});

	it("does not hide non-configuration sync failures", async () => {
		const { service, subscriptionSync } = setup();
		subscriptionSync.syncFromStripe.mockRejectedValueOnce(
			new Error("Stripe request failed"),
		);

		await expect(service.sync(user)).rejects.toThrow("Stripe request failed");
	});
});
