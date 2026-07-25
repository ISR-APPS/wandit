import { DOMAIN_TLD_CATALOG } from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidDomainStateError } from "../../../domains/domain/errors/domain.errors";
import type { DomainsRepository } from "../../../domains/infrastructure/persistence/domains.repository";
import { OrderInvariantViolationError } from "../../domain/errors/payment-order.errors";
import type { PaymentOrderRow } from "../../domain/payment-order.types";
import { DomainRegistrationFulfillment } from "./domain-registration.fulfillment";

const orderId = "11111111-1111-4111-8111-111111111111";
const domainId = "22222222-2222-4222-8222-222222222222";
const userId = "user_1";
const originalQueueEnabled = process.env.QUEUE_ENABLED;

class FakeDomainsRepository {
	readonly findOrCreatePurchasedForOrder = vi.fn(async () => ({
		id: domainId,
		name: "example.com",
		paymentOrderId: orderId,
		userId,
	}));
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

beforeEach(() => {
	process.env.QUEUE_ENABLED = "true";
});

afterEach(() => {
	if (originalQueueEnabled === undefined) {
		delete process.env.QUEUE_ENABLED;
	} else {
		process.env.QUEUE_ENABLED = originalQueueEnabled;
	}
});

describe("DomainRegistrationFulfillment", () => {
	it("creates or reuses the linked domain and enqueues the deterministic money job", async () => {
		const repository = new FakeDomainsRepository();
		const queue = {
			add: vi.fn(async () => undefined),
		};
		const fulfillment = new DomainRegistrationFulfillment(
			repository as unknown as DomainsRepository,
			queue as never,
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
		expect(queue.add).toHaveBeenCalledWith(
			"domain-purchase",
			{
				domainId,
				orderId,
				paymentSource: "order",
			},
			{
				attempts: 5,
				backoff: {
					delay: 60_000,
					type: "exponential",
				},
				jobId: `order-fulfill-${orderId}`,
			},
		);
	});

	it("rejects malformed stored metadata before creating or queueing a domain", async () => {
		const repository = new FakeDomainsRepository();
		const queue = {
			add: vi.fn(async () => undefined),
		};
		const fulfillment = new DomainRegistrationFulfillment(
			repository as unknown as DomainsRepository,
			queue as never,
		);

		await expect(
			fulfillment.fulfill(paymentOrder({ domain: "example.com" })),
		).rejects.toBeInstanceOf(OrderInvariantViolationError);
		expect(repository.findOrCreatePurchasedForOrder).not.toHaveBeenCalled();
		expect(queue.add).not.toHaveBeenCalled();
	});

	it("does not create or enqueue when the repository observes a refunded order", async () => {
		const repository = new FakeDomainsRepository();
		repository.findOrCreatePurchasedForOrder.mockRejectedValueOnce(
			new InvalidDomainStateError(
				"Payment order is no longer eligible for domain fulfillment",
			),
		);
		const queue = {
			add: vi.fn(async () => undefined),
		};
		const fulfillment = new DomainRegistrationFulfillment(
			repository as unknown as DomainsRepository,
			queue as never,
		);

		await expect(fulfillment.fulfill(paymentOrder())).rejects.toMatchObject({
			message: "Payment order is no longer eligible for domain fulfillment",
		});

		expect(repository.findOrCreatePurchasedForOrder).toHaveBeenCalledOnce();
		expect(queue.add).not.toHaveBeenCalled();
	});
});
