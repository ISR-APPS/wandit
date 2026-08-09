import { DOMAIN_TLD_CATALOG } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { InvalidDomainStateError } from "../../../domains/domain/errors/domain.errors";
import type { DomainTaskDispatcher } from "../../../domains/domain/ports/domain-task-dispatcher.port";
import type { DomainsRepository } from "../../../domains/infrastructure/persistence/domains.repository";
import { OrderInvariantViolationError } from "../../domain/errors/payment-order.errors";
import type { PaymentOrderRow } from "../../domain/payment-order.types";
import { DomainRegistrationFulfillment } from "./domain-registration.fulfillment";

const orderId = "11111111-1111-4111-8111-111111111111";
const domainId = "22222222-2222-4222-8222-222222222222";
const userId = "user_1";

class FakeDomainsRepository {
	row = {
		id: domainId,
		name: "example.com",
		paymentOrderId: orderId,
		userId,
	};
	readonly findOrCreatePurchasedForOrder = vi.fn(async () => ({
		...this.row,
	}));
}

class FakeDomainTaskDispatcher {
	readonly triggerPurchase = vi.fn(
		async (_payload: { domainId: string; orderId: string }) => ({
			id: "run_domain_purchase",
		}),
	);
}

function paymentOrder(
	metadata: PaymentOrderRow["metadata"] = validMetadata(),
): PaymentOrderRow {
	const now = new Date("2026-07-24T12:00:00.000Z");

	return {
		amountCents: 3_000,
		createdAt: now,
		currency: "usd",
		fulfilledAt: null,
		fulfillmentError: null,
		id: orderId,
		kind: "domain_registration",
		metadata,
		paidAt: now,
		provider: "stripe",
		providerCheckoutSessionId: "cs_test_domain",
		providerPaymentIntentId: "pi_test_domain",
		providerPaymentStatus: "paid",
		providerRefundId: null,
		refundStatus: null,
		status: "fulfilling",
		updatedAt: now,
		userId,
	};
}

function validMetadata() {
	return {
		domain: "example.com",
		priceSnapshot: {
			chargedAmountCents: 3000,
			chargedCurrency: "usd",
			quotedWholesaleUsd: 11.06,
			tld: "com",
			wholesaleCeilingUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd,
		},
		registrant: {
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
		},
		tld: "com",
		whoisPrivacy: true,
	};
}

describe("DomainRegistrationFulfillment", () => {
	it("creates or reuses the linked domain and dispatches the strict purchase payload", async () => {
		const repository = new FakeDomainsRepository();
		const dispatcher = new FakeDomainTaskDispatcher();
		const fulfillment = new DomainRegistrationFulfillment(
			repository as unknown as DomainsRepository,
			dispatcher as unknown as DomainTaskDispatcher,
		);

		await fulfillment.fulfill(paymentOrder());

		expect(repository.findOrCreatePurchasedForOrder).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "example.com",
				paymentOrderId: orderId,
				projectId: null,
				tld: "com",
				userId,
				whoisPrivacy: true,
			}),
		);
		expect(dispatcher.triggerPurchase).toHaveBeenCalledOnce();
		expect(dispatcher.triggerPurchase).toHaveBeenCalledWith({
			domainId,
			orderId,
		});
	});

	it("rejects malformed stored metadata before creating or dispatching a domain", async () => {
		const repository = new FakeDomainsRepository();
		const dispatcher = new FakeDomainTaskDispatcher();
		const fulfillment = new DomainRegistrationFulfillment(
			repository as unknown as DomainsRepository,
			dispatcher as unknown as DomainTaskDispatcher,
		);

		await expect(
			fulfillment.fulfill(paymentOrder({ domain: "example.com" })),
		).rejects.toBeInstanceOf(OrderInvariantViolationError);
		expect(repository.findOrCreatePurchasedForOrder).not.toHaveBeenCalled();
		expect(dispatcher.triggerPurchase).not.toHaveBeenCalled();
	});

	it("does not create or dispatch when the repository observes a refunded order", async () => {
		const repository = new FakeDomainsRepository();
		repository.findOrCreatePurchasedForOrder.mockRejectedValueOnce(
			new InvalidDomainStateError(
				"Payment order is no longer eligible for domain fulfillment",
			),
		);
		const dispatcher = new FakeDomainTaskDispatcher();
		const fulfillment = new DomainRegistrationFulfillment(
			repository as unknown as DomainsRepository,
			dispatcher as unknown as DomainTaskDispatcher,
		);

		await expect(fulfillment.fulfill(paymentOrder())).rejects.toMatchObject({
			message: "Payment order is no longer eligible for domain fulfillment",
		});

		expect(repository.findOrCreatePurchasedForOrder).toHaveBeenCalledOnce();
		expect(dispatcher.triggerPurchase).not.toHaveBeenCalled();
	});

	it("rejects a mismatched fenced row before dispatch", async () => {
		const repository = new FakeDomainsRepository();
		repository.row = {
			...repository.row,
			paymentOrderId: "33333333-3333-4333-8333-333333333333",
		};
		const dispatcher = new FakeDomainTaskDispatcher();
		const fulfillment = new DomainRegistrationFulfillment(
			repository as unknown as DomainsRepository,
			dispatcher as unknown as DomainTaskDispatcher,
		);

		await expect(fulfillment.fulfill(paymentOrder())).rejects.toBeInstanceOf(
			OrderInvariantViolationError,
		);
		expect(dispatcher.triggerPurchase).not.toHaveBeenCalled();
	});

	it("propagates a rejected handoff after row creation so the paid order remains retryable", async () => {
		const repository = new FakeDomainsRepository();
		const dispatcher = new FakeDomainTaskDispatcher();
		dispatcher.triggerPurchase.mockRejectedValueOnce(
			new Error("Trigger handoff unavailable"),
		);
		const fulfillment = new DomainRegistrationFulfillment(
			repository as unknown as DomainsRepository,
			dispatcher as unknown as DomainTaskDispatcher,
		);

		await expect(fulfillment.fulfill(paymentOrder())).rejects.toThrow(
			"Trigger handoff unavailable",
		);
		expect(repository.findOrCreatePurchasedForOrder).toHaveBeenCalledOnce();
		expect(dispatcher.triggerPurchase).toHaveBeenCalledWith({
			domainId,
			orderId,
		});
	});
});
