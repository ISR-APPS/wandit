import type { AuthUser } from "@wandit/auth";
import { describe, expect, it, vi } from "vitest";

import type { PaymentProvider } from "../../domain/ports/payment-provider.port";
import type {
	BillingCustomerRow,
	BillingCustomersRepository,
	BillingCustomersTransaction,
	UpsertBillingCustomerInput,
} from "../../infrastructure/persistence/billing-customers.repository";
import { BillingCustomerService } from "./billing-customer.service";

const user = {
	email: "user@example.com",
	id: "user_1",
} as AuthUser;

class FakeBillingCustomersRepository {
	readonly transaction = {} as BillingCustomersTransaction;
	readonly lockUserIds: string[] = [];
	row: BillingCustomerRow | null = null;
	private readonly lockTails = new Map<string, Promise<void>>();

	findByUserId = vi.fn(
		async (_userId: string, _client?: BillingCustomersTransaction) => this.row,
	);
	upsertByUserId = vi.fn(
		async (
			input: UpsertBillingCustomerInput,
			_client?: BillingCustomersTransaction,
		) => {
			this.row = {
				...input,
				createdAt: new Date("2026-07-24T10:00:00.000Z"),
				id: "11111111-1111-4111-8111-111111111111",
				openCheckoutSessionId: null,
				updatedAt: new Date("2026-07-24T10:00:00.000Z"),
			};

			return this.row;
		},
	);

	withUserLock<T>(
		userId: string,
		fn: (tx: BillingCustomersTransaction) => Promise<T>,
	): Promise<T> {
		this.lockUserIds.push(userId);
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

class FakePaymentProvider {
	ensureCustomer = vi.fn(
		async (_userId: string, _email: string) => "cus_shared",
	);
}

function setup() {
	const billingCustomers = new FakeBillingCustomersRepository();
	const paymentProvider = new FakePaymentProvider();
	const service = new BillingCustomerService(
		billingCustomers as unknown as BillingCustomersRepository,
		paymentProvider as unknown as PaymentProvider,
	);

	return { billingCustomers, paymentProvider, service };
}

describe("BillingCustomerService", () => {
	it("serializes concurrent creation through one shared customer path", async () => {
		const { billingCustomers, paymentProvider, service } = setup();

		const [first, second] = await Promise.all([
			service.ensureCustomer(user),
			service.ensureCustomer(user),
		]);

		expect(first).toEqual(second);
		expect(first.providerCustomerId).toBe("cus_shared");
		expect(billingCustomers.lockUserIds).toEqual([user.id, user.id]);
		expect(billingCustomers.findByUserId).toHaveBeenCalledTimes(2);
		expect(billingCustomers.findByUserId).toHaveBeenNthCalledWith(
			1,
			user.id,
			billingCustomers.transaction,
		);
		expect(billingCustomers.findByUserId).toHaveBeenNthCalledWith(
			2,
			user.id,
			billingCustomers.transaction,
		);
		expect(paymentProvider.ensureCustomer).toHaveBeenCalledTimes(1);
		expect(paymentProvider.ensureCustomer).toHaveBeenCalledWith(
			user.id,
			user.email,
		);
		expect(billingCustomers.upsertByUserId).toHaveBeenCalledTimes(1);
		expect(billingCustomers.upsertByUserId).toHaveBeenCalledWith(
			{
				provider: "stripe",
				providerCustomerId: "cus_shared",
				userId: user.id,
			},
			billingCustomers.transaction,
		);
	});

	it("returns an existing mapping without creating another Stripe customer", async () => {
		const { billingCustomers, paymentProvider, service } = setup();
		billingCustomers.row = {
			createdAt: new Date("2026-07-24T10:00:00.000Z"),
			id: "11111111-1111-4111-8111-111111111111",
			openCheckoutSessionId: null,
			provider: "stripe",
			providerCustomerId: "cus_existing",
			updatedAt: new Date("2026-07-24T10:00:00.000Z"),
			userId: user.id,
		};

		await expect(service.ensureCustomer(user)).resolves.toBe(
			billingCustomers.row,
		);
		expect(paymentProvider.ensureCustomer).not.toHaveBeenCalled();
		expect(billingCustomers.upsertByUserId).not.toHaveBeenCalled();
	});
});
