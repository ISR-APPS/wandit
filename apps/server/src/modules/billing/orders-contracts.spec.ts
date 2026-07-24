import {
	billingRoutes,
	CHECKOUT_PURPOSE,
	createDomainOrderBodySchema,
	createOrderResponseSchema,
	ordersRoutes,
	paymentOrderKindSchema,
	paymentOrderKinds,
	paymentOrderSchema,
	paymentOrderStatuses,
	paymentOrderStatusSchema,
	reconcileSessionBodySchema,
	registrantSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const orderId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";

const validRegistrant = {
	firstName: "Zack",
	lastName: "Belaid",
	email: "zack@example.com",
	phone: "+213555123456",
	address: {
		street: "12 Rue Didouche Mourad",
		city: "Algiers",
		wilaya: "Alger",
		zip: "16000",
	},
};

const pendingOrder = {
	id: orderId,
	kind: "domain_registration",
	status: "pending",
	amountCents: 2_500,
	currency: "usd",
	createdAt: "2026-07-24T12:00:00.000Z",
	paidAt: null,
	fulfilledAt: null,
	error: null,
	refundStatus: null,
};

describe("payment order contracts", () => {
	it("mirrors the payment order enum values", () => {
		expect(paymentOrderKinds).toEqual(["domain_registration"]);
		for (const kind of paymentOrderKinds) {
			expect(paymentOrderKindSchema.parse(kind)).toBe(kind);
		}

		expect(paymentOrderStatuses).toEqual([
			"pending",
			"paid",
			"fulfilling",
			"fulfilled",
			"failed",
			"canceled",
			"refunded",
		]);
		for (const status of paymentOrderStatuses) {
			expect(paymentOrderStatusSchema.parse(status)).toBe(status);
		}
	});

	it("parses domain order input with the shared registrant contract", () => {
		const input = createDomainOrderBodySchema.parse({
			domain: "Example.COM",
			registrant: validRegistrant,
			projectId,
			whoisPrivacy: false,
		});

		expect(input).toEqual({
			domain: "example.com",
			registrant: registrantSchema.parse(validRegistrant),
			projectId,
			whoisPrivacy: false,
		});
	});

	it("round-trips payment orders and create-order responses", () => {
		expect(paymentOrderSchema.parse(pendingOrder)).toEqual(pendingOrder);

		const checkoutUrl = "https://checkout.stripe.com/c/pay/cs_test_123";
		const response = { order: pendingOrder, checkoutUrl };

		expect(createOrderResponseSchema.parse(response)).toEqual(response);
		expect(
			paymentOrderSchema.parse({
				...pendingOrder,
				status: "fulfilled",
				checkoutUrl,
				domainId: projectId,
				paidAt: "2026-07-24T12:01:00.000Z",
				fulfilledAt: "2026-07-24T12:02:00.000Z",
			}),
		).toEqual({
			...pendingOrder,
			status: "fulfilled",
			checkoutUrl,
			domainId: projectId,
			paidAt: "2026-07-24T12:01:00.000Z",
			fulfilledAt: "2026-07-24T12:02:00.000Z",
		});

		expect(
			paymentOrderSchema.parse({
				...pendingOrder,
				refundStatus: "requires_action",
				status: "failed",
			}),
		).toMatchObject({
			refundStatus: "requires_action",
			status: "failed",
		});
	});

	it("rejects invalid money and lifecycle values", () => {
		expect(
			paymentOrderSchema.safeParse({
				...pendingOrder,
				amountCents: 0,
			}).success,
		).toBe(false);
		expect(
			paymentOrderSchema.safeParse({
				...pendingOrder,
				currency: "USD",
			}).success,
		).toBe(false);
		expect(
			paymentOrderSchema.safeParse({
				...pendingOrder,
				status: "complete",
			}).success,
		).toBe(false);
		expect(
			paymentOrderSchema.safeParse({
				...pendingOrder,
				kind: "domain_transfer",
			}).success,
		).toBe(false);
	});

	it("exports checkout discriminators, reconcile input, and API routes", () => {
		expect(CHECKOUT_PURPOSE).toEqual({
			subscription: "subscription",
			topup: "topup",
			order: "order",
		});
		expect(
			reconcileSessionBodySchema.parse({ sessionId: "cs_test_123" }),
		).toEqual({
			sessionId: "cs_test_123",
		});
		expect(ordersRoutes.createDomain).toBe("/api/v1/orders/domain");
		expect(ordersRoutes.byId(orderId)).toBe(`/api/v1/orders/${orderId}`);
		expect(ordersRoutes.reconcileSession).toBe(
			"/api/v1/orders/reconcile-session",
		);
		expect(billingRoutes.sync).toBe("/api/v1/billing/sync");
		expect(
			reconcileSessionBodySchema.safeParse({ sessionId: "" }).success,
		).toBe(false);
	});
});
