import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { PaymentRefundsService } from "../../../billing/application/services/payment-refunds.service";
import { StripeEventRouter } from "../../../billing/application/services/stripe-event-router.service";
import type { StripeSubscriptionSyncService } from "../../../billing/application/services/stripe-subscription-sync.service";
import type { SubscriptionCreditsService } from "../../../billing/application/services/subscription-credits.service";
import type { BillingCheckoutAttemptsRepository } from "../../../billing/infrastructure/persistence/billing-checkout-attempts.repository";
import type { BillingCustomersRepository } from "../../../billing/infrastructure/persistence/billing-customers.repository";
import type { AffiliateClawbackService } from "./affiliate-clawback.service";
import type { AffiliateCommissionService } from "./affiliate-commission.service";

function event(type: string, object: unknown): Stripe.Event {
	return {
		data: { object },
		id: `evt_${type}`,
		type,
	} as Stripe.Event;
}

function setup(input: { affiliateClawbackHandled?: boolean } = {}) {
	const order: string[] = [];
	const customers = {} as BillingCustomersRepository;
	const sync = {
		syncFromStripe: vi.fn(async () => {
			order.push("customer-sync");
			return [];
		}),
	} as unknown as StripeSubscriptionSyncService;
	const credits = {
		grantForPaidInvoice: vi.fn(async () => {
			order.push("credit-policy");
			return false;
		}),
	} as unknown as SubscriptionCreditsService;
	const refunds = {
		handleChargeDisputeClosed: vi.fn(async () => {
			order.push("billing-clawback");
			return false;
		}),
		handleChargeDisputeCreated: vi.fn(async () => {
			order.push("billing-clawback");
			return false;
		}),
		handleChargeRefunded: vi.fn(async () => {
			order.push("billing-clawback");
			return false;
		}),
		handleRefundUpdated: vi.fn(async () => {
			order.push("billing-clawback");
			return false;
		}),
	} as unknown as PaymentRefundsService;
	const commission = {
		handlePaidInvoice: vi.fn(async () => {
			order.push("affiliate-candidate");
			return true;
		}),
	} as unknown as AffiliateCommissionService;
	const clawback = {
		handleChargeRefunded: vi.fn(async () => {
			order.push("affiliate-clawback");
			return input.affiliateClawbackHandled ?? true;
		}),
		handleRefundUpdated: vi.fn(async () => {
			order.push("affiliate-clawback");
			return input.affiliateClawbackHandled ?? true;
		}),
		handleDisputeCreated: vi.fn(async () => {
			order.push("affiliate-clawback");
			return input.affiliateClawbackHandled ?? true;
		}),
		handleDisputeWon: vi.fn(async () => {
			order.push("affiliate-clawback");
			return input.affiliateClawbackHandled ?? true;
		}),
	} as unknown as AffiliateClawbackService;
	const router = new StripeEventRouter(
		customers,
		sync,
		credits,
		refunds,
		{} as BillingCheckoutAttemptsRepository,
		undefined,
		commission,
		clawback,
	);

	return { clawback, commission, order, refunds, router };
}

describe("affiliate Stripe routing", () => {
	it("runs commission candidate handling after the paid-invoice credit policy", async () => {
		const { order, router } = setup();
		const invoice = { customer: "cus_1", id: "in_1" } as Stripe.Invoice;

		await expect(router.route(event("invoice.paid", invoice))).resolves.toEqual(
			{
				status: "processed",
			},
		);
		expect(order).toEqual([
			"customer-sync",
			"credit-policy",
			"affiliate-candidate",
		]);
	});

	it("runs billing clawback first, then affiliates, and ORs handled outcomes", async () => {
		const { order, router } = setup();
		const charge = { id: "ch_1" } as Stripe.Charge;

		await expect(
			router.route(event("charge.refunded", charge)),
		).resolves.toEqual({ status: "processed" });
		expect(order).toEqual(["billing-clawback", "affiliate-clawback"]);
	});

	it("routes a successful refund lifecycle update through both cumulative ledgers", async () => {
		const { clawback, order, refunds, router } = setup();
		const refund = {
			charge: "ch_1",
			id: "re_1",
			status: "succeeded",
		} as Stripe.Refund;

		await expect(
			router.route(event("refund.updated", refund)),
		).resolves.toEqual({
			status: "processed",
		});

		expect(refunds.handleRefundUpdated).toHaveBeenCalledWith(refund);
		expect(clawback.handleRefundUpdated).toHaveBeenCalledWith(refund);
		expect(order).toEqual(["billing-clawback", "affiliate-clawback"]);
	});

	it("handles created and won disputes through both cumulative ledgers", async () => {
		const { clawback, refunds, router } = setup();
		const created = {
			charge: "ch_1",
			id: "dp_1",
			status: "needs_response",
		} as Stripe.Dispute;
		const won = { ...created, status: "won" } as Stripe.Dispute;

		await router.route(event("charge.dispute.created", created));
		await router.route(event("charge.dispute.closed", won));

		expect(refunds.handleChargeDisputeCreated).toHaveBeenCalledWith(created);
		expect(clawback.handleDisputeCreated).toHaveBeenCalledWith(created);
		expect(refunds.handleChargeDisputeClosed).toHaveBeenCalledWith(won);
		expect(clawback.handleDisputeWon).toHaveBeenCalledWith(won);
	});

	it("reconciles Stripe's prevented dispute state in the affiliate ledger", async () => {
		const { clawback, refunds, router } = setup();
		const prevented = {
			charge: "ch_1",
			id: "dp_prevented",
			status: "prevented",
		} as Stripe.Dispute;

		await expect(
			router.route(event("charge.dispute.closed", prevented)),
		).resolves.toEqual({ status: "processed" });

		expect(refunds.handleChargeDisputeClosed).toHaveBeenCalledWith(prevented);
		expect(clawback.handleDisputeWon).toHaveBeenCalledWith(prevented);
	});
});
