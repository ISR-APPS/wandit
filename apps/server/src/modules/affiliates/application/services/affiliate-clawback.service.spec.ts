import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { StripeProvider } from "../../../billing/infrastructure/stripe/stripe.provider";
import type {
	AffiliateCommissionRow,
	AffiliatesRepository,
	AffiliateTransaction,
	InsertAdjustmentInput,
} from "../../infrastructure/persistence/affiliates.repository";
import { AffiliateClawbackService } from "./affiliate-clawback.service";

const transaction = {} as AffiliateTransaction;
const createdAt = new Date("2026-02-01T00:00:00.000Z");

function commission(
	overrides: Partial<AffiliateCommissionRow> = {},
): AffiliateCommissionRow {
	return {
		affiliateId: "11111111-1111-4111-8111-111111111111",
		amountCents: 2_000,
		attributionId: "22222222-2222-4222-8222-222222222222",
		baseAmountCents: 10_000,
		createdAt,
		currency: "usd",
		entryType: "earning",
		holdUntil: new Date("2026-03-01T00:00:00.000Z"),
		id: "33333333-3333-4333-8333-333333333333",
		originalCommissionId: null,
		payoutId: null,
		rateBps: 2_000,
		reversalReason: null,
		status: "pending",
		stripeChargeId: "ch_1",
		stripeDisputeId: null,
		stripeInvoiceId: "in_1",
		stripeRefundId: null,
		updatedAt: createdAt,
		...overrides,
	};
}

function refund(
	id: string,
	amount: number,
	created = 1_700_000_000,
): Stripe.Refund {
	return {
		amount,
		created,
		id,
		status: "succeeded",
	} as Stripe.Refund;
}

function dispute(
	id: string,
	amount: number,
	status: Stripe.Dispute.Status = "needs_response",
): Stripe.Dispute {
	return {
		amount,
		charge: "ch_1",
		id,
		status,
	} as Stripe.Dispute;
}

class FakeAffiliatesRepository {
	readonly adjustments: AffiliateCommissionRow[] = [];
	readonly insertInputs: InsertAdjustmentInput[] = [];
	earning: AffiliateCommissionRow | null = commission();
	withChargeLockCalls = 0;
	private adjustmentSequence = 0;
	private readonly lockTails = new Map<string, Promise<void>>();

	async withChargeLock<T>(
		chargeId: string,
		operation: (tx: AffiliateTransaction) => Promise<T>,
	): Promise<T> {
		this.withChargeLockCalls += 1;
		const previous = this.lockTails.get(chargeId) ?? Promise.resolve();
		let release: () => void = () => undefined;
		const next = new Promise<void>((resolve) => {
			release = () => resolve();
		});
		this.lockTails.set(
			chargeId,
			previous.then(() => next),
		);

		await previous;
		try {
			return await operation(transaction);
		} finally {
			release();
		}
	}

	findEarningByChargeId = vi.fn(async () => this.earning);
	findEarningByInvoiceId = vi.fn(async (invoiceId: string) =>
		this.earning?.stripeInvoiceId === invoiceId ? this.earning : null,
	);

	listAdjustments = vi.fn(async () => [...this.adjustments]);
	lockCharge = vi.fn(async () => undefined);

	insertAdjustment = vi.fn(async (input: InsertAdjustmentInput) => {
		this.insertInputs.push(input);
		this.adjustmentSequence += 1;
		const row = commission({
			...input,
			createdAt: new Date(createdAt.getTime() + this.adjustmentSequence),
			entryType: "adjustment",
			id: `adjustment_${this.adjustmentSequence}`,
			payoutId: null,
			stripeDisputeId: input.stripeDisputeId ?? null,
			stripeRefundId: input.stripeRefundId ?? null,
			updatedAt: new Date(createdAt.getTime() + this.adjustmentSequence),
		});
		this.adjustments.push(row);
		return row;
	});
}

class FakeStripeProvider {
	charge = { amount: 10_000, id: "ch_1" } as Stripe.Charge;
	refunds: Stripe.Refund[] = [];
	disputes: Stripe.Dispute[] = [];

	retrieveCharge = vi.fn(async () => this.charge);
	listRefundsForCharge = vi.fn(async () => [...this.refunds]);
	listDisputesForCharge = vi.fn(async () => [...this.disputes]);
}

function setup() {
	const repository = new FakeAffiliatesRepository();
	const stripe = new FakeStripeProvider();
	const service = new AffiliateClawbackService(
		repository as unknown as AffiliatesRepository,
		stripe as unknown as StripeProvider,
	);

	return { repository, service, stripe };
}

describe("AffiliateClawbackService", () => {
	it("refreshes Stripe state only after acquiring the shared charge lock", async () => {
		const { repository, service, stripe } = setup();
		const order: string[] = [];
		repository.withChargeLock = vi.fn(async (_chargeId, operation) => {
			order.push("charge-lock");
			return operation(transaction);
		});
		stripe.retrieveCharge.mockImplementationOnce(async () => {
			order.push("stripe-refresh");
			return stripe.charge;
		});
		stripe.refunds = [refund("re_1", 1_000)];

		await service.handleChargeRefunded({ id: "ch_1" } as Stripe.Charge);

		expect(order).toEqual(["charge-lock", "stripe-refresh"]);
	});

	it("reconciles adverse Stripe state that arrived before the earning", async () => {
		const { repository, service, stripe } = setup();
		stripe.refunds = [refund("re_before_earning", 2_500)];

		await expect(service.reconcileInvoiceAfterEarning("in_1")).resolves.toBe(
			true,
		);

		expect(repository.findEarningByInvoiceId).toHaveBeenCalledWith("in_1");
		expect(repository.insertInputs[0]).toEqual(
			expect.objectContaining({
				amountCents: -500,
				originalCommissionId: repository.earning?.id,
				stripeRefundId: "re_before_earning",
			}),
		);
	});

	it("reuses an invoice finalizer transaction for the shared charge lock", async () => {
		const { repository, service, stripe } = setup();
		stripe.refunds = [refund("re_same_tx", 1_000)];

		await expect(
			service.reconcileInvoiceAfterEarning("in_1", transaction),
		).resolves.toBe(true);

		expect(repository.lockCharge).toHaveBeenCalledWith("ch_1", transaction);
		expect(repository.withChargeLockCalls).toBe(0);
		expect(repository.findEarningByInvoiceId).toHaveBeenCalledWith(
			"in_1",
			transaction,
		);
	});

	it("links adjustments to the earning and caps cumulative refund/dispute overlap", async () => {
		const { repository, service, stripe } = setup();
		stripe.refunds = [refund("re_1", 4_000)];

		await expect(
			service.handleChargeRefunded({ id: "ch_1" } as Stripe.Charge),
		).resolves.toBe(true);

		expect(repository.insertInputs[0]).toEqual(
			expect.objectContaining({
				amountCents: -800,
				originalCommissionId: repository.earning?.id,
				status: "approved",
				stripeRefundId: "re_1",
			}),
		);

		const adverseDispute = dispute("dp_1", 7_000);
		stripe.disputes = [adverseDispute];
		await expect(service.handleDisputeCreated(adverseDispute)).resolves.toBe(
			true,
		);

		expect(repository.insertInputs[1]).toEqual(
			expect.objectContaining({
				amountCents: -1_200,
				originalCommissionId: repository.earning?.id,
				stripeDisputeId: "dp_1",
			}),
		);
		expect(
			repository.adjustments.reduce(
				(sum, adjustment) => sum + adjustment.amountCents,
				0,
			),
		).toBe(-2_000);
	});

	it("claws back a refund that becomes successful after its initial event", async () => {
		const { repository, service, stripe } = setup();
		const pendingRefund = {
			...refund("re_late_success", 2_500),
			charge: "ch_1",
			status: "pending",
		} as Stripe.Refund;

		await expect(service.handleRefundUpdated(pendingRefund)).resolves.toBe(
			false,
		);
		expect(stripe.retrieveCharge).not.toHaveBeenCalled();

		const successfulRefund = {
			...pendingRefund,
			status: "succeeded",
		} as Stripe.Refund;
		stripe.refunds = [successfulRefund];

		await expect(service.handleRefundUpdated(successfulRefund)).resolves.toBe(
			true,
		);
		expect(repository.insertInputs[0]).toEqual(
			expect.objectContaining({
				amountCents: -500,
				stripeRefundId: "re_late_success",
			}),
		);
	});

	it("compensates a won dispute without reusing its unique Stripe id and replays idempotently", async () => {
		const { repository, service, stripe } = setup();
		const adverseDispute = dispute("dp_1", 6_000);
		stripe.disputes = [adverseDispute];

		await expect(service.handleDisputeCreated(adverseDispute)).resolves.toBe(
			true,
		);
		expect(repository.adjustments[0]?.amountCents).toBe(-1_200);

		const wonDispute = dispute("dp_1", 6_000, "won");
		stripe.disputes = [wonDispute];
		await expect(service.handleDisputeWon(wonDispute)).resolves.toBe(true);
		expect(repository.insertInputs[1]).toEqual(
			expect.objectContaining({
				amountCents: 1_200,
				originalCommissionId: repository.earning?.id,
				reversalReason: "dispute_won:dp_1",
				stripeDisputeId: null,
			}),
		);

		await expect(service.handleDisputeWon(wonDispute)).resolves.toBe(true);
		expect(repository.insertAdjustment).toHaveBeenCalledTimes(2);
		expect(
			repository.adjustments.reduce(
				(sum, adjustment) => sum + adjustment.amountCents,
				0,
			),
		).toBe(0);
	});

	it("treats a prevented dispute as non-adverse and compensates its clawback", async () => {
		const { repository, service, stripe } = setup();
		const adverseDispute = dispute("dp_prevented", 5_000);
		stripe.disputes = [adverseDispute];

		await expect(service.handleDisputeCreated(adverseDispute)).resolves.toBe(
			true,
		);

		const preventedDispute = dispute("dp_prevented", 5_000, "prevented");
		stripe.disputes = [preventedDispute];
		await expect(service.handleDisputeWon(preventedDispute)).resolves.toBe(
			true,
		);

		expect(repository.insertInputs[1]).toEqual(
			expect.objectContaining({
				amountCents: 1_000,
				reversalReason: "dispute_prevented:dp_prevented",
				stripeDisputeId: null,
			}),
		);
	});

	it("creates an approved negative carry when the original earning was already paid", async () => {
		const { repository, service, stripe } = setup();
		repository.earning = commission({
			payoutId: "44444444-4444-4444-8444-444444444444",
			status: "paid",
		});
		stripe.refunds = [refund("re_after_payout", 5_000)];

		await expect(
			service.handleChargeRefunded({ id: "ch_1" } as Stripe.Charge),
		).resolves.toBe(true);

		expect(repository.insertInputs[0]).toEqual(
			expect.objectContaining({
				amountCents: -1_000,
				originalCommissionId: repository.earning.id,
				status: "approved",
				stripeRefundId: "re_after_payout",
			}),
		);
		expect(repository.adjustments[0]?.payoutId).toBeNull();
	});
});
