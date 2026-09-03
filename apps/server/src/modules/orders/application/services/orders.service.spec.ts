import type { AuthUser } from "@wandit/auth";
import { DOMAIN_TLD_CATALOG, type PaymentOrderStatus } from "@wandit/contracts";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { BillingCustomerService } from "../../../billing/application/services/billing-customer.service";
import type { PaymentProvider } from "../../../billing/domain/ports/payment-provider.port";
import type { BillingCustomersRepository } from "../../../billing/infrastructure/persistence/billing-customers.repository";
import type { DomainsService } from "../../../domains/application/services/domains.service";
import {
	DomainAlreadyExistsError,
	PremiumDomainBlockedError,
} from "../../../domains/domain/errors/domain.errors";
import type { DomainsRepository } from "../../../domains/infrastructure/persistence/domains.repository";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	OrderInvariantViolationError,
	OrderNotFoundError,
} from "../../domain/errors/payment-order.errors";
import type { PaymentOrderRow } from "../../domain/payment-order.types";
import type { OrderRefundDispatcher } from "../../domain/ports/order-refund-dispatcher.port";
import type { PaymentOrdersRepository } from "../../infrastructure/persistence/payment-orders.repository";
import type { OrderFulfillmentRegistry } from "./order-fulfillment.registry";
import type { OrderRefundsService } from "./order-refunds.service";
import { OrdersService } from "./orders.service";

const orderId = "11111111-1111-4111-8111-111111111111";
const domainId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const userId = "user_1";
const otherUserId = "user_2";
const sessionId = "cs_test_domain";
const paymentIntentId = "pi_test_domain";
const customerId = "cus_test_domain";
const now = new Date("2026-07-24T12:00:00.000Z");
const quotedWholesaleUsd = 11.06;
const domainOrderAmountCents = 1_306;

const user = {
	email: "buyer@example.com",
	id: userId,
} as AuthUser;

const scope: ProjectScope = { kind: "personal", userId };

const registrant = {
	firstName: "Zack",
	lastName: "Belaid",
	email: "zack@example.com",
	phone: "+213555123456",
	address: {
		street: "12 Rue Didouche Mourad",
		city: "Algiers",
		wilaya: "Alger",
		zip: "16000",
		countryCode: "DZ",
	},
};

class FakePaymentOrdersRepository {
	beforeLockedById: (() => Promise<void> | void) | null = null;
	readonly rows = new Map<string, PaymentOrderRow>();
	readonly markPaid = vi.fn(
		async (
			id: string,
			input: {
				paymentIntentId: string;
				paymentStatus: string;
				sessionId: string;
			},
		) => {
			const row = this.rows.get(id);

			if (row?.status !== "pending") {
				return null;
			}

			const updated = {
				...row,
				paidAt: new Date(now.getTime() + 1_000),
				providerCheckoutSessionId: input.sessionId,
				providerPaymentIntentId: input.paymentIntentId,
				providerPaymentStatus: input.paymentStatus,
				status: "paid" as const,
			};
			this.rows.set(id, updated);

			return updated;
		},
	);
	readonly markFulfilling = vi.fn(async (id: string) => {
		const row = this.rows.get(id);

		if (row?.status !== "paid") {
			return null;
		}

		const updated = { ...row, status: "fulfilling" as const };
		this.rows.set(id, updated);

		return updated;
	});
	readonly markFailed = vi.fn(async (id: string, error: string) => {
		const row = this.rows.get(id);

		if (row?.status !== "paid" && row?.status !== "fulfilling") {
			return null;
		}

		const updated = {
			...row,
			fulfillmentError: error,
			status: "failed" as const,
		};
		this.rows.set(id, updated);

		return updated;
	});
	readonly markRefunded = vi.fn(async (id: string, _client?: unknown) => {
		const row = this.rows.get(id);

		if (
			!row ||
			!["pending", "paid", "fulfilling", "fulfilled", "failed"].includes(
				row.status,
			)
		) {
			return null;
		}

		const updated = { ...row, status: "refunded" as const };
		this.rows.set(id, updated);

		return updated;
	});
	readonly recordPaymentState = vi.fn(
		async (
			id: string,
			input: {
				paymentIntentId: string | null;
				paymentStatus: string;
				sessionId: string;
			},
		) => {
			const row = this.rows.get(id);

			if (!row) {
				return null;
			}

			const updated = {
				...row,
				providerCheckoutSessionId: input.sessionId,
				providerPaymentIntentId:
					input.paymentIntentId ?? row.providerPaymentIntentId,
				providerPaymentStatus: input.paymentStatus,
			};
			this.rows.set(id, updated);

			return updated;
		},
	);
	readonly markPendingTerminal = vi.fn(
		async (
			id: string,
			status: "canceled" | "failed",
			input: {
				fulfillmentError: string | null;
				paymentIntentId: string | null;
				paymentStatus: string;
				sessionId?: string;
			},
		) => {
			const row = this.rows.get(id);

			if (row?.status !== "pending") {
				return null;
			}

			const updated = {
				...row,
				fulfillmentError: input.fulfillmentError,
				providerCheckoutSessionId:
					input.sessionId ?? row.providerCheckoutSessionId,
				providerPaymentIntentId:
					input.paymentIntentId ?? row.providerPaymentIntentId,
				providerPaymentStatus: input.paymentStatus,
				status,
			};
			this.rows.set(id, updated);

			return updated;
		},
	);

	async insert(input: {
		amountCents: number;
		currency: string;
		kind: "domain_registration";
		metadata: unknown;
		userId: string;
	}) {
		const row = paymentOrderRow({
			...input,
			id: orderId,
		});
		this.rows.set(row.id, row);

		return row;
	}

	async attachCheckoutSession(id: string, checkoutSessionId: string) {
		const row = this.rows.get(id);

		if (row?.status !== "pending") {
			return null;
		}

		const updated = {
			...row,
			providerCheckoutSessionId: checkoutSessionId,
		};
		this.rows.set(id, updated);

		return updated;
	}

	async findById(id: string) {
		return this.rows.get(id) ?? null;
	}

	async findByIdForUser(id: string, ownerId: string) {
		const row = this.rows.get(id);

		if (!row || row.userId !== ownerId) {
			throw new OrderNotFoundError();
		}

		return row;
	}

	async findBySessionIdForUser(checkoutSessionId: string, ownerId: string) {
		const row = [...this.rows.values()].find(
			(candidate) =>
				candidate.providerCheckoutSessionId === checkoutSessionId &&
				candidate.userId === ownerId,
		);

		if (!row) {
			throw new OrderNotFoundError();
		}

		return row;
	}

	async findByPaymentIntentId(providerPaymentIntentId: string) {
		return (
			[...this.rows.values()].find(
				(row) => row.providerPaymentIntentId === providerPaymentIntentId,
			) ?? null
		);
	}

	async withLockedById<T>(
		id: string,
		operation: (row: PaymentOrderRow, tx: never) => Promise<T>,
	) {
		const beforeLockedById = this.beforeLockedById;
		this.beforeLockedById = null;
		await beforeLockedById?.();
		const row = this.rows.get(id);

		if (!row) {
			throw new OrderNotFoundError();
		}

		return operation(row, {} as never);
	}

	seed(
		overrides: Partial<PaymentOrderRow> & {
			status?: PaymentOrderStatus;
		} = {},
	) {
		const row = paymentOrderRow(overrides);
		this.rows.set(row.id, row);

		return row;
	}
}

class FakeDomainsService {
	readonly preparePurchase = vi.fn(
		async (_scope: ProjectScope, domain: string, _projectId?: string) => ({
			name: domain.trim().toLowerCase(),
			quotedWholesaleUsd,
			tld: "com" as const,
			wholesaleCeilingUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd,
		}),
	);
}

class FakeDomainsRepository {
	readonly orderDomains = new Map<string, string>();

	async findByPaymentOrderId(id: string) {
		const idForDomain = this.orderDomains.get(id);

		return idForDomain ? ({ id: idForDomain } as never) : null;
	}
}

class FakeBillingCustomersRepository {
	readonly rows = new Map<
		string,
		{
			createdAt: Date;
			id: string;
			provider: string;
			providerCustomerId: string;
			updatedAt: Date;
			userId: string;
		}
	>();

	constructor() {
		this.rows.set(userId, this.customer(userId, customerId));
	}

	async findByUserId(id: string) {
		return this.rows.get(id) ?? null;
	}

	async upsertByUserId(input: {
		provider: string;
		providerCustomerId: string;
		userId: string;
	}) {
		const row = this.customer(input.userId, input.providerCustomerId);
		this.rows.set(input.userId, row);

		return row;
	}

	private customer(id: string, providerCustomerId: string) {
		return {
			createdAt: now,
			id: `bc_${id}`,
			provider: "stripe",
			providerCustomerId,
			updatedAt: now,
			userId: id,
		};
	}
}

class FakeBillingCustomerService {
	readonly ensureCustomer = vi.fn(
		async (requestedUser: Pick<AuthUser, "email" | "id">) => ({
			createdAt: now,
			id: `bc_${requestedUser.id}`,
			provider: "stripe",
			providerCustomerId: customerId,
			updatedAt: now,
			userId: requestedUser.id,
		}),
	);
}

class FakePaymentProvider {
	session = checkoutSession();
	paymentIntent = stripePaymentIntent();
	charge = stripeCharge();
	readonly createOrderCheckout = vi.fn(async () => ({
		id: sessionId,
		url: "https://checkout.stripe.com/c/pay/cs_test_domain",
	}));
	readonly createRefund = vi.fn(async () => undefined);
	readonly ensureCustomer = vi.fn(async () => customerId);
	readonly retrieveCharge = vi.fn(async () => this.charge);
	readonly retrieveCheckoutSession = vi.fn(async () => this.session);
	readonly retrievePaymentIntent = vi.fn(async () => this.paymentIntent);
}

class FakeFulfillmentRegistry {
	error: Error | null = null;
	failures = 0;
	readonly handoffs = new Set<string>();
	readonly fulfill = vi.fn(async (order: PaymentOrderRow) => {
		if (this.error) {
			throw this.error;
		}

		if (this.failures > 0) {
			this.failures -= 1;
			throw new Error("Trigger handoff unavailable");
		}
		this.handoffs.add(order.id);
	});

	forKind(kind: string) {
		if (kind !== "domain_registration") {
			throw new Error(`Unexpected kind ${kind}`);
		}

		return {
			fulfill: this.fulfill,
			kind: "domain_registration" as const,
		};
	}
}

class FakeOrderRefundsService {
	constructor(private readonly orders: FakePaymentOrdersRepository) {}

	readonly markRefundedByPaymentIntent = vi.fn(
		async (input: {
			cause?: "dispute";
			chargeId: string;
			paymentIntentId: string;
		}) => {
			const order = [...this.orders.rows.values()].find(
				(order) => order.providerPaymentIntentId === input.paymentIntentId,
			);

			if (!order) {
				return false;
			}

			return (await this.orders.markRefunded(order.id)) !== null;
		},
	);
	readonly handleChargeRefundedByPaymentIntent = vi.fn(
		async (input: {
			amountCaptured: number;
			amountRefunded: number;
			chargeId: string;
			paymentIntentId: string;
		}) => {
			if (input.amountRefunded >= input.amountCaptured) {
				return this.markRefundedByPaymentIntent(input);
			}

			const order = [...this.orders.rows.values()].find(
				(order) => order.providerPaymentIntentId === input.paymentIntentId,
			);

			if (!order) {
				return false;
			}

			this.orders.rows.set(order.id, {
				...order,
				fulfillmentError:
					"Manual review required: Stripe reported a partial refund for this domain order; fulfillment was intentionally left unchanged.",
				refundStatus: "partial",
			});

			return true;
		},
	);
}

class FakeOrderRefundDispatcher {
	triggerFailure: Error | null = null;
	readonly triggerRefund = vi.fn(
		async (_payload: { failureReason: string; orderId: string }) => {
			if (this.triggerFailure) {
				throw this.triggerFailure;
			}

			return { id: "run_order_refund" };
		},
	);
}

function setup() {
	const orders = new FakePaymentOrdersRepository();
	const domainsService = new FakeDomainsService();
	const domainsRepository = new FakeDomainsRepository();
	const customers = new FakeBillingCustomersRepository();
	const customerService = new FakeBillingCustomerService();
	const payments = new FakePaymentProvider();
	const fulfillment = new FakeFulfillmentRegistry();
	const orderRefunds = new FakeOrderRefundsService(orders);
	const refundDispatcher = new FakeOrderRefundDispatcher();
	const service = new OrdersService(
		orders as unknown as PaymentOrdersRepository,
		domainsService as unknown as DomainsService,
		domainsRepository as unknown as DomainsRepository,
		customerService as unknown as BillingCustomerService,
		customers as unknown as BillingCustomersRepository,
		payments as unknown as PaymentProvider,
		fulfillment as unknown as OrderFulfillmentRegistry,
		orderRefunds as unknown as OrderRefundsService,
		refundDispatcher as unknown as OrderRefundDispatcher,
	);

	return {
		customerService,
		customers,
		domainsRepository,
		domainsService,
		fulfillment,
		orderRefunds,
		orders,
		payments,
		refundDispatcher,
		service,
	};
}

function paymentOrderRow(
	overrides: Partial<PaymentOrderRow> = {},
): PaymentOrderRow {
	return {
		amountCents: domainOrderAmountCents,
		createdAt: now,
		currency: "usd",
		fulfilledAt: null,
		fulfillmentError: null,
		id: orderId,
		kind: "domain_registration",
		metadata: {
			domain: "example.com",
			priceSnapshot: {
				chargedAmountCents: domainOrderAmountCents,
				chargedCurrency: "usd",
				quotedWholesaleUsd,
				tld: "com",
				wholesaleCeilingUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd,
			},
			registrant,
			tld: "com",
			whoisPrivacy: false,
		},
		paidAt: null,
		provider: "stripe",
		providerCheckoutSessionId: sessionId,
		providerPaymentIntentId: null,
		providerPaymentStatus: null,
		providerRefundId: null,
		refundStatus: null,
		status: "pending",
		updatedAt: now,
		userId,
		...overrides,
	};
}

function checkoutSession(
	overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
	return {
		amount_total: domainOrderAmountCents,
		currency: "usd",
		customer: customerId,
		id: sessionId,
		metadata: {
			orderId,
			orderKind: "domain_registration",
			purpose: "order",
			userId,
		},
		mode: "payment",
		payment_intent: { id: paymentIntentId },
		payment_status: "paid",
		...overrides,
	} as Stripe.Checkout.Session;
}

function stripePaymentIntent(
	overrides: Partial<Stripe.PaymentIntent> = {},
): Stripe.PaymentIntent {
	return {
		id: paymentIntentId,
		latest_charge: "ch_test_domain",
		...overrides,
	} as Stripe.PaymentIntent;
}

function stripeCharge(overrides: Partial<Stripe.Charge> = {}): Stripe.Charge {
	return {
		amount: domainOrderAmountCents,
		amount_captured: domainOrderAmountCents,
		amount_refunded: 0,
		disputed: false,
		id: "ch_test_domain",
		payment_intent: paymentIntentId,
		refunded: false,
		...overrides,
	} as Stripe.Charge;
}

describe("OrdersService", () => {
	it("creates a server-priced domain order and checkout session", async () => {
		const { customerService, orders, payments, service } = setup();

		const result = await service.createDomainOrder(
			user,
			{
				domain: "example.com",
				projectId,
				registrant,
				whoisPrivacy: false,
			},
			scope,
		);

		expect(result.order).toMatchObject({
			amountCents: domainOrderAmountCents,
			currency: "usd",
			id: orderId,
			status: "pending",
		});
		expect(result.checkoutUrl).toContain("checkout.stripe.com");
		expect(customerService.ensureCustomer).toHaveBeenCalledOnce();
		expect(customerService.ensureCustomer).toHaveBeenCalledWith(user);
		expect(payments.ensureCustomer).not.toHaveBeenCalled();
		expect(payments.createOrderCheckout).toHaveBeenCalledWith(
			expect.objectContaining({
				amountCents: domainOrderAmountCents,
				cancelUrl: "http://web.test/billing/cancel",
				currency: "usd",
				customerId,
				kind: "domain_registration",
				orderId,
				productName: "Domain registration: example.com",
				successUrl:
					"http://web.test/billing/success?purpose=order&session_id={CHECKOUT_SESSION_ID}",
				userId,
			}),
		);
		expect(orders.rows.get(orderId)?.metadata).toMatchObject({
			domain: "example.com",
			priceSnapshot: {
				chargedAmountCents: domainOrderAmountCents,
				chargedCurrency: "usd",
				quotedWholesaleUsd,
				tld: "com",
				wholesaleCeilingUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd,
			},
			projectId,
			tld: "com",
			whoisPrivacy: false,
		});
		expect(orders.rows.get(orderId)?.providerCheckoutSessionId).toBe(sessionId);
	});

	it.each([
		{
			cancelUrl: `http://web.test/p/${projectId}?checkout=cancel`,
			returnPath: `/p/${projectId}`,
			successUrl: `http://web.test/p/${projectId}?checkout=success&purpose=order&session_id={CHECKOUT_SESSION_ID}`,
		},
		{
			cancelUrl: `http://web.test/p/${projectId}?tab=settings&checkout=cancel`,
			returnPath: `/p/${projectId}?tab=settings`,
			successUrl: `http://web.test/p/${projectId}?tab=settings&checkout=success&purpose=order&session_id={CHECKOUT_SESSION_ID}`,
		},
		{
			cancelUrl: `http://web.test/p/${projectId}?next=?&checkout=cancel`,
			returnPath: `/p/${projectId}?next=?`,
			successUrl: `http://web.test/p/${projectId}?next=?&checkout=success&purpose=order&session_id={CHECKOUT_SESSION_ID}`,
		},
	])("returns checkout to $returnPath", async ({
		cancelUrl,
		returnPath,
		successUrl,
	}) => {
		const { payments, service } = setup();

		await service.createDomainOrder(
			user,
			{
				domain: "example.com",
				projectId,
				registrant,
				returnPath,
			},
			scope,
		);

		expect(payments.createOrderCheckout).toHaveBeenCalledWith(
			expect.objectContaining({
				cancelUrl,
				successUrl,
			}),
		);
	});

	it("defaults WHOIS privacy to off when the body omits it", async () => {
		const { orders, service } = setup();

		await service.createDomainOrder(
			user,
			{
				domain: "example.com",
				projectId,
				registrant,
			},
			scope,
		);

		expect(orders.rows.get(orderId)?.metadata).toMatchObject({
			whoisPrivacy: false,
		});
	});

	it("keeps the money-losing guard as a sanity invariant", async () => {
		const { domainsService, orders, payments, service } = setup();
		domainsService.preparePurchase.mockResolvedValueOnce({
			name: "example.com",
			// Pathological input: at this magnitude, floating-point precision can no
			// longer preserve the two-dollar margin. DomainsService rejects it first
			// in production, while this keeps the OrdersService invariant covered.
			quotedWholesaleUsd: 1e17,
			tld: "com" as const,
			wholesaleCeilingUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd,
		});

		await expect(
			service.createDomainOrder(
				user,
				{
					domain: "example.com",
					projectId,
					registrant,
				},
				scope,
			),
		).rejects.toBeInstanceOf(PremiumDomainBlockedError);

		expect(payments.createOrderCheckout).not.toHaveBeenCalled();
		expect(orders.rows.size).toBe(0);
	});

	it.each([
		["amount", { amount_total: domainOrderAmountCents + 1 }],
		["currency", { currency: "eur" }],
		["customer", { customer: "cus_someone_else" }],
	] as const)("rejects a checkout %s mismatch without marking the order paid", async (_label, mismatch) => {
		const { orders, payments, service } = setup();
		orders.seed();
		payments.session = checkoutSession(mismatch);

		await expect(service.reconcileBySession(sessionId)).rejects.toBeInstanceOf(
			OrderInvariantViolationError,
		);
		expect(orders.markPaid).not.toHaveBeenCalled();
		expect(orders.rows.get(orderId)?.status).toBe("pending");
	});

	it("records an unpaid session without changing order status", async () => {
		const { fulfillment, orders, payments, service } = setup();
		orders.seed();
		payments.session = checkoutSession({
			payment_status: "unpaid",
		});

		await service.reconcileBySession(sessionId);

		expect(orders.rows.get(orderId)).toMatchObject({
			providerPaymentIntentId: paymentIntentId,
			providerPaymentStatus: "unpaid",
			status: "pending",
		});
		expect(orders.markPaid).not.toHaveBeenCalled();
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
	});

	it("uses the paid CAS winner to dispatch fulfillment only once", async () => {
		const { fulfillment, orders, payments, service } = setup();
		orders.seed();

		await service.reconcileBySession(sessionId);
		await service.reconcileBySession(sessionId);

		expect(orders.markPaid).toHaveBeenCalledTimes(2);
		expect(orders.markFulfilling).toHaveBeenCalledTimes(1);
		expect(fulfillment.fulfill).toHaveBeenCalledTimes(1);
		expect(fulfillment.handoffs).toEqual(new Set([orderId]));
		expect(orders.rows.get(orderId)?.status).toBe("fulfilling");
		expect(payments.retrievePaymentIntent).toHaveBeenCalledTimes(2);
		expect(payments.retrievePaymentIntent).toHaveBeenCalledWith(
			paymentIntentId,
		);
		expect(payments.retrieveCharge).toHaveBeenCalledTimes(2);
		expect(payments.retrieveCharge).toHaveBeenCalledWith("ch_test_domain");
	});

	it("records an early Stripe refund before a locally unmapped paid order can fulfill", async () => {
		const { fulfillment, orderRefunds, orders, payments, service } = setup();
		orders.seed({
			paidAt: null,
			providerPaymentIntentId: null,
			status: "pending",
		});
		payments.paymentIntent = stripePaymentIntent({
			latest_charge: "ch_refunded_before_mapping",
		});
		payments.retrievePaymentIntent.mockImplementationOnce(async () => {
			expect(orders.rows.get(orderId)?.providerPaymentIntentId).toBe(
				paymentIntentId,
			);

			return payments.paymentIntent;
		});
		payments.charge = stripeCharge({
			amount_refunded: domainOrderAmountCents,
			id: "ch_refunded_before_mapping",
			refunded: true,
		});

		await expect(
			service.reconcileBySession(sessionId),
		).resolves.toBeUndefined();

		expect(payments.retrievePaymentIntent).toHaveBeenCalledWith(
			paymentIntentId,
		);
		expect(payments.retrieveCharge).toHaveBeenCalledWith(
			"ch_refunded_before_mapping",
		);
		expect(orders.markPaid).toHaveBeenCalledWith(
			orderId,
			{
				paymentIntentId,
				paymentStatus: "paid",
				sessionId,
			},
			expect.anything(),
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			providerPaymentIntentId: paymentIntentId,
			providerPaymentStatus: "paid",
			status: "refunded",
		});
		expect(orders.recordPaymentState).not.toHaveBeenCalled();
		expect(orders.markRefunded).toHaveBeenCalledWith(orderId);
		expect(
			orderRefunds.handleChargeRefundedByPaymentIntent,
		).toHaveBeenCalledWith({
			amountCaptured: domainOrderAmountCents,
			amountRefunded: domainOrderAmountCents,
			chargeId: "ch_refunded_before_mapping",
			paymentIntentId,
		});
		expect(orderRefunds.markRefundedByPaymentIntent).toHaveBeenCalledWith({
			amountCaptured: domainOrderAmountCents,
			amountRefunded: domainOrderAmountCents,
			chargeId: "ch_refunded_before_mapping",
			paymentIntentId,
		});
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
		expect(fulfillment.handoffs).toEqual(new Set());
		expect(orders.markFulfilling).not.toHaveBeenCalled();
		expect(payments.createRefund).not.toHaveBeenCalled();
	});

	it("records an early partial Stripe refund for manual review without fulfilling", async () => {
		const { fulfillment, orderRefunds, orders, payments, service } = setup();
		orders.seed({
			paidAt: null,
			providerPaymentIntentId: null,
			status: "pending",
		});
		payments.paymentIntent = stripePaymentIntent({
			latest_charge: "ch_partially_refunded_before_mapping",
		});
		payments.charge = stripeCharge({
			amount_refunded: 1,
			id: "ch_partially_refunded_before_mapping",
		});

		await expect(
			service.reconcileBySession(sessionId),
		).resolves.toBeUndefined();

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: expect.stringContaining("partial refund"),
			providerPaymentIntentId: paymentIntentId,
			providerPaymentStatus: "paid",
			refundStatus: "partial",
			status: "paid",
		});
		expect(
			orderRefunds.handleChargeRefundedByPaymentIntent,
		).toHaveBeenCalledWith({
			amountCaptured: domainOrderAmountCents,
			amountRefunded: 1,
			chargeId: "ch_partially_refunded_before_mapping",
			paymentIntentId,
		});
		expect(orderRefunds.markRefundedByPaymentIntent).not.toHaveBeenCalled();
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
		expect(orders.markFulfilling).not.toHaveBeenCalled();
		expect(payments.createRefund).not.toHaveBeenCalled();
	});

	it("gives an early Stripe dispute precedence over a simultaneous partial refund", async () => {
		const { fulfillment, orderRefunds, orders, payments, service } = setup();
		orders.seed({
			paidAt: null,
			providerPaymentIntentId: null,
			status: "pending",
		});
		payments.paymentIntent = stripePaymentIntent({
			latest_charge: "ch_disputed_before_mapping",
		});
		payments.retrievePaymentIntent.mockImplementationOnce(async () => {
			expect(orders.rows.get(orderId)?.providerPaymentIntentId).toBe(
				paymentIntentId,
			);

			return payments.paymentIntent;
		});
		payments.charge = stripeCharge({
			amount_refunded: 1,
			disputed: true,
			id: "ch_disputed_before_mapping",
		});

		await expect(
			service.reconcileBySession(sessionId),
		).resolves.toBeUndefined();

		expect(orders.rows.get(orderId)).toMatchObject({
			providerPaymentIntentId: paymentIntentId,
			providerPaymentStatus: "paid",
			status: "refunded",
		});
		expect(orderRefunds.markRefundedByPaymentIntent).toHaveBeenCalledWith({
			chargeId: "ch_disputed_before_mapping",
			cause: "dispute",
			paymentIntentId,
		});
		expect(
			orderRefunds.handleChargeRefundedByPaymentIntent,
		).not.toHaveBeenCalled();
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
		expect(orders.markFulfilling).not.toHaveBeenCalled();
		expect(payments.createRefund).not.toHaveBeenCalled();
	});

	it("leaves a paid order retryable when the fulfillment handoff fails", async () => {
		const { fulfillment, orders, service } = setup();
		orders.seed();
		fulfillment.failures = 1;

		await expect(service.reconcileBySession(sessionId)).rejects.toThrow(
			"Trigger handoff unavailable",
		);
		expect(orders.rows.get(orderId)?.status).toBe("paid");

		await expect(
			service.reconcileBySession(sessionId),
		).resolves.toBeUndefined();
		expect(fulfillment.fulfill).toHaveBeenCalledTimes(2);
		expect(fulfillment.handoffs).toEqual(new Set([orderId]));
		expect(orders.rows.get(orderId)?.status).toBe("fulfilling");
	});

	it("leaves a paid order with no domain terminalization when fulfillment rethrows an invariant violation", async () => {
		const { fulfillment, orders, refundDispatcher, service } = setup();
		orders.seed();
		fulfillment.error = new OrderInvariantViolationError(
			`Payment order ${orderId} has invalid domain-registration metadata`,
		);

		await expect(service.reconcileBySession(sessionId)).rejects.toBeInstanceOf(
			OrderInvariantViolationError,
		);
		expect(orders.rows.get(orderId)?.status).toBe("paid");
		expect(refundDispatcher.triggerRefund).not.toHaveBeenCalled();
		expect(orders.markFailed).not.toHaveBeenCalled();
		expect(orders.markFulfilling).not.toHaveBeenCalled();
	});

	it("accepts a refund Trigger handoff before failing an order whose domain was already claimed", async () => {
		const { fulfillment, orders, payments, refundDispatcher, service } =
			setup();
		orders.seed();
		fulfillment.error = new DomainAlreadyExistsError("example.com");

		await service.reconcileBySession(sessionId);
		await service.reconcileBySession(sessionId);

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: "example.com is already connected to Wandit",
			status: "failed",
		});
		expect(refundDispatcher.triggerRefund).toHaveBeenCalledTimes(2);
		expect(refundDispatcher.triggerRefund).toHaveBeenCalledWith({
			failureReason: "example.com is already connected to Wandit",
			orderId,
		});
		expect(
			refundDispatcher.triggerRefund.mock.invocationCallOrder[0],
		).toBeLessThan(orders.markFailed.mock.invocationCallOrder[0] ?? 0);
		expect(payments.createRefund).not.toHaveBeenCalled();
		expect(orders.markFulfilling).not.toHaveBeenCalled();
	});

	it("keeps a duplicate-domain order paid when the refund Trigger handoff is rejected", async () => {
		const { fulfillment, orders, refundDispatcher, service } = setup();
		orders.seed();
		fulfillment.error = new DomainAlreadyExistsError("example.com");
		refundDispatcher.triggerFailure = new Error("Trigger unavailable");

		await expect(service.reconcileBySession(sessionId)).rejects.toThrow(
			"Trigger unavailable",
		);
		expect(orders.rows.get(orderId)?.status).toBe("paid");
		expect(refundDispatcher.triggerRefund).toHaveBeenCalledWith({
			failureReason: "example.com is already connected to Wandit",
			orderId,
		});
		expect(orders.markFailed).not.toHaveBeenCalled();
	});

	it("rejects a foreign user's reconcile request before retrieving Stripe", async () => {
		const { orders, payments, service } = setup();
		orders.seed();

		await expect(
			service.reconcileSessionForUser(otherUserId, sessionId),
		).rejects.toBeInstanceOf(OrderNotFoundError);
		expect(payments.retrieveCheckoutSession).not.toHaveBeenCalled();
	});

	it("cancels an expired checkout session without crediting or fulfilling", async () => {
		const { fulfillment, orders, payments, service } = setup();
		orders.seed();
		payments.session = checkoutSession({
			payment_intent: "pi_async_failed",
			payment_status: "unpaid",
			status: "expired",
		});

		await service.reconcileBySession(sessionId);

		expect(orders.rows.get(orderId)).toMatchObject({
			providerPaymentIntentId: "pi_async_failed",
			providerPaymentStatus: "unpaid",
			status: "canceled",
		});
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
	});

	it("honors an expired webhook outcome before the retrieved session reflects it", async () => {
		const { fulfillment, orders, payments, service } = setup();
		orders.seed();
		payments.session = checkoutSession({
			payment_intent: "pi_expired_webhook",
			payment_status: "unpaid",
			status: "open",
		});

		await service.reconcileBySession(sessionId, "expired");

		expect(orders.rows.get(orderId)).toMatchObject({
			providerPaymentIntentId: "pi_expired_webhook",
			providerPaymentStatus: "unpaid",
			status: "canceled",
		});
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
	});

	it("fails a completed unpaid asynchronous checkout without refunding", async () => {
		const { fulfillment, orders, payments, refundDispatcher, service } =
			setup();
		orders.seed();
		payments.session = checkoutSession({
			payment_intent: "pi_async_failed",
			payment_status: "unpaid",
			status: "complete",
		});

		await service.reconcileBySession(sessionId, "async_payment_failed");

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: "Payment could not be completed",
			providerPaymentIntentId: "pi_async_failed",
			providerPaymentStatus: "unpaid",
			status: "failed",
		});
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
		expect(refundDispatcher.triggerRefund).not.toHaveBeenCalled();
	});

	it("keeps completed unpaid delayed payment pending until async success", async () => {
		const { fulfillment, orders, payments, service } = setup();
		orders.seed();
		payments.session = checkoutSession({
			payment_intent: "pi_delayed_payment",
			payment_status: "unpaid",
			status: "complete",
		});

		await service.reconcileBySession(sessionId, "completed");

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: null,
			providerPaymentIntentId: "pi_delayed_payment",
			providerPaymentStatus: "unpaid",
			status: "pending",
		});
		expect(orders.markPendingTerminal).not.toHaveBeenCalled();
		expect(fulfillment.fulfill).not.toHaveBeenCalled();

		payments.session = checkoutSession({
			payment_intent: "pi_delayed_payment",
			payment_status: "paid",
			status: "complete",
		});
		payments.paymentIntent = stripePaymentIntent({
			id: "pi_delayed_payment",
			latest_charge: "ch_delayed_payment",
		});
		payments.charge = stripeCharge({
			id: "ch_delayed_payment",
			payment_intent: "pi_delayed_payment",
		});

		await service.reconcileBySession(sessionId, "async_payment_succeeded");

		expect(orders.rows.get(orderId)).toMatchObject({
			providerPaymentIntentId: "pi_delayed_payment",
			providerPaymentStatus: "paid",
			status: "fulfilling",
		});
		expect(fulfillment.fulfill).toHaveBeenCalledOnce();
	});

	it.each([
		[
			"failed",
			"requires_payment_method",
			"failed",
			"Payment could not be completed",
		],
		["canceled", "canceled", "canceled", null],
	] as const)("maps a %s payment-intent event to a terminal pending-order state idempotently", async (outcome, providerPaymentStatus, status, error) => {
		const { fulfillment, orders, payments, refundDispatcher, service } =
			setup();
		orders.seed({
			providerPaymentIntentId: paymentIntentId,
		});
		payments.session = checkoutSession({
			payment_status: "unpaid",
			status: "complete",
		});

		await expect(
			service.reconcileByPaymentIntent(
				paymentIntentId,
				outcome,
				providerPaymentStatus,
			),
		).resolves.toBe(true);
		await expect(
			service.reconcileByPaymentIntent(
				paymentIntentId,
				outcome,
				providerPaymentStatus,
			),
		).resolves.toBe(true);

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: error,
			providerPaymentStatus,
			status,
		});
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
		expect(refundDispatcher.triggerRefund).not.toHaveBeenCalled();
	});

	it("keeps an open-session payment-intent failure pending while recording provider state", async () => {
		const { fulfillment, orders, payments, refundDispatcher, service } =
			setup();
		orders.seed({
			providerPaymentIntentId: paymentIntentId,
		});
		payments.session = checkoutSession({
			payment_status: "unpaid",
			status: "open",
		});

		await expect(
			service.reconcileByPaymentIntent(
				paymentIntentId,
				"failed",
				"requires_payment_method",
			),
		).resolves.toBe(true);

		expect(payments.retrieveCheckoutSession).toHaveBeenCalledWith(sessionId);
		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: null,
			providerPaymentIntentId: paymentIntentId,
			providerPaymentStatus: "requires_payment_method",
			status: "pending",
		});
		expect(orders.recordPaymentState).toHaveBeenCalledWith(
			orderId,
			{
				paymentIntentId,
				paymentStatus: "requires_payment_method",
				sessionId,
			},
			expect.anything(),
		);
		expect(orders.markPendingTerminal).not.toHaveBeenCalled();
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
		expect(refundDispatcher.triggerRefund).not.toHaveBeenCalled();
	});

	it("does not overwrite a concurrently successful order with stale open-session payment state", async () => {
		const { orders, payments, service } = setup();
		orders.seed({
			providerPaymentIntentId: paymentIntentId,
		});
		payments.session = checkoutSession({
			payment_status: "unpaid",
			status: "open",
		});
		orders.beforeLockedById = async () => {
			await orders.markPaid(orderId, {
				paymentIntentId,
				paymentStatus: "paid",
				sessionId,
			});
			await orders.markFulfilling(orderId);
		};

		await service.reconcileByPaymentIntent(
			paymentIntentId,
			"failed",
			"requires_payment_method",
		);

		expect(orders.rows.get(orderId)).toMatchObject({
			providerPaymentIntentId: paymentIntentId,
			providerPaymentStatus: "paid",
			status: "fulfilling",
		});
		expect(orders.recordPaymentState).not.toHaveBeenCalled();
		expect(orders.markPendingTerminal).not.toHaveBeenCalled();
	});

	it("fulfills an open session after its same-session card retry succeeds without refunding", async () => {
		const { fulfillment, orders, payments, refundDispatcher, service } =
			setup();
		orders.seed({
			providerPaymentIntentId: paymentIntentId,
		});
		payments.session = checkoutSession({
			payment_status: "unpaid",
			status: "open",
		});

		await service.reconcileByPaymentIntent(
			paymentIntentId,
			"failed",
			"requires_payment_method",
		);

		payments.session = checkoutSession({
			payment_status: "paid",
			status: "complete",
		});

		await service.reconcileByPaymentIntent(
			paymentIntentId,
			"succeeded",
			"succeeded",
		);

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: null,
			providerPaymentIntentId: paymentIntentId,
			providerPaymentStatus: "paid",
			status: "fulfilling",
		});
		expect(orders.markPaid).toHaveBeenCalledOnce();
		expect(orders.markFulfilling).toHaveBeenCalledOnce();
		expect(fulfillment.fulfill).toHaveBeenCalledOnce();
		expect(refundDispatcher.triggerRefund).not.toHaveBeenCalled();
		expect(payments.createRefund).not.toHaveBeenCalled();
	});

	it("reconciles a stale payment-intent failure from a complete paid session without refunding", async () => {
		const { fulfillment, orders, payments, refundDispatcher, service } =
			setup();
		orders.seed({
			providerPaymentIntentId: paymentIntentId,
		});
		payments.session = checkoutSession({
			payment_status: "paid",
			status: "complete",
		});

		await service.reconcileByPaymentIntent(
			paymentIntentId,
			"failed",
			"requires_payment_method",
		);

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: null,
			providerPaymentIntentId: paymentIntentId,
			providerPaymentStatus: "paid",
			status: "fulfilling",
		});
		expect(payments.retrieveCheckoutSession).toHaveBeenCalledTimes(2);
		expect(orders.markPendingTerminal).not.toHaveBeenCalled();
		expect(orders.markPaid).toHaveBeenCalledOnce();
		expect(orders.markFulfilling).toHaveBeenCalledOnce();
		expect(fulfillment.fulfill).toHaveBeenCalledOnce();
		expect(refundDispatcher.triggerRefund).not.toHaveBeenCalled();
		expect(payments.createRefund).not.toHaveBeenCalled();
	});

	it("cancels an expired session when its payment intent fails", async () => {
		const { fulfillment, orders, payments, refundDispatcher, service } =
			setup();
		orders.seed({
			providerPaymentIntentId: paymentIntentId,
		});
		payments.session = checkoutSession({
			payment_status: "unpaid",
			status: "expired",
		});

		await expect(
			service.reconcileByPaymentIntent(
				paymentIntentId,
				"failed",
				"requires_payment_method",
			),
		).resolves.toBe(true);

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: null,
			providerPaymentIntentId: paymentIntentId,
			providerPaymentStatus: "requires_payment_method",
			status: "canceled",
		});
		expect(orders.markPendingTerminal).toHaveBeenCalledWith(
			orderId,
			"canceled",
			{
				fulfillmentError: null,
				paymentIntentId,
				paymentStatus: "requires_payment_method",
				sessionId,
			},
		);
		expect(orders.recordPaymentState).not.toHaveBeenCalled();
		expect(fulfillment.fulfill).not.toHaveBeenCalled();
		expect(refundDispatcher.triggerRefund).not.toHaveBeenCalled();
	});

	it("returns false for an unrelated payment intent and reconciles a known one", async () => {
		const { orders, service } = setup();
		const row = orders.seed({
			providerPaymentIntentId: paymentIntentId,
		});

		await expect(
			service.reconcileByPaymentIntent("pi_unrelated"),
		).resolves.toBe(false);
		await expect(
			service.reconcileByPaymentIntent(paymentIntentId),
		).resolves.toBe(true);
		expect(orders.rows.get(row.id)?.status).toBe("fulfilling");
	});

	it("returns owned orders with a linked domain id", async () => {
		const { domainsRepository, orders, service } = setup();
		orders.seed({ status: "fulfilled" });
		domainsRepository.orderDomains.set(orderId, domainId);

		await expect(
			service.getOrderForUser(userId, orderId),
		).resolves.toMatchObject({
			domainId,
			id: orderId,
			status: "fulfilled",
		});
	});
});
