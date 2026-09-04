import { describe, expect, it, vi } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import type { FinancialReconciliationOutboxRepository } from "../../infrastructure/persistence/financial-reconciliation-outbox.repository";
import type {
	RefillSlotRow,
	SubscriptionCreditRow,
	SubscriptionCreditsRepository,
	SubscriptionCreditsTransaction,
} from "../../infrastructure/persistence/subscription-credits.repository";
import type { PaymentRefundsService } from "./payment-refunds.service";
import { SubscriptionRefillService } from "./subscription-refill.service";

const TX = {} as SubscriptionCreditsTransaction;

function subscription(): SubscriptionCreditRow {
	return {
		cancelAtPeriodEnd: false,
		createdAt: new Date(0),
		currentPeriodEnd: new Date("2027-01-31T12:00:00.000Z"),
		currentPeriodStart: new Date("2026-01-31T12:00:00.000Z"),
		id: "sub_local",
		interval: "year",
		organizationId: null,
		pendingAppliedBy: null,
		pendingInterval: null,
		pendingPlan: null,
		pendingTierCredits: null,
		plan: "pro",
		priceLookupKey: "pro_250_year",
		provider: "stripe",
		providerSubscriptionId: "sub_remote",
		status: "active",
		tierCredits: 250,
		updatedAt: new Date(0),
		userId: "user_1",
	};
}

function slot(overrides: Partial<RefillSlotRow>): RefillSlotRow {
	return {
		canceledAt: null,
		canceledReason: null,
		credits: 25_000,
		dueAt: new Date("2026-03-01T00:00:00.000Z"),
		fundingChargeId: "ch_old",
		fundingInvoiceId: "in_old",
		fundingPaymentIntentId: "pi_old",
		grantedAt: null,
		id: "slot_1",
		periodOrdinal: 2,
		status: "pending",
		subscriptionId: "sub_local",
		supersededByInvoiceId: null,
		...overrides,
	};
}

function setup(dueSlots: RefillSlotRow[]) {
	const repository = {
		cancelPendingSlotsForSubscription: vi.fn(async () => 8),
		claimDueSlot: vi.fn(
			async (slotId: string) =>
				dueSlots.find((candidate) => candidate.id === slotId) ?? null,
		),
		findDuePendingSlotsForSubscription: vi.fn(async () => dueSlots),
		insertRefillSlots: vi.fn(async () => []),
	};
	const credits = { applyCappedRefill: vi.fn(async () => ({})) };
	const outbox = {
		enqueue: vi.fn(
			async (_input: { chargeId: string; triggerRef: string }) => null,
		),
	};
	const service = new SubscriptionRefillService(
		repository as unknown as SubscriptionCreditsRepository,
		credits as unknown as CreditsService,
		{} as PaymentRefundsService,
		outbox as unknown as FinancialReconciliationOutboxRepository,
	);

	return { credits, outbox, repository, service };
}

describe("SubscriptionRefillService", () => {
	it("returns the distinct funding charges of claimed slots and enqueues each for reconciliation", async () => {
		const { credits, outbox, service } = setup([
			slot({ id: "slot_1" }),
			slot({ id: "slot_2", periodOrdinal: 3 }),
			slot({
				fundingChargeId: null,
				fundingPaymentIntentId: null,
				id: "slot_3",
				periodOrdinal: 4,
			}),
		]);

		const result = await service.grantDuePendingSlots(
			subscription(),
			new Date("2026-06-01T00:00:00.000Z"),
			TX,
		);

		expect(result).toEqual({ fundingChargeIds: ["ch_old"], granted: 3 });
		expect(credits.applyCappedRefill).toHaveBeenCalledTimes(3);
		expect(outbox.enqueue.mock.calls.map(([input]) => input)).toEqual([
			{ chargeId: "ch_old", triggerRef: "slot:slot_1" },
			{ chargeId: "ch_old", triggerRef: "slot:slot_2" },
		]);
	});

	it("cancels the remaining slots as replaced by the new invoice before planning new ones", async () => {
		const { repository, service } = setup([slot({ id: "slot_1" })]);

		const result = await service.replacePendingYearlySlots(
			{
				credits: 50_000,
				funding: {
					chargeId: "ch_new",
					invoiceId: "in_new",
					paymentIntentId: "pi_new",
				},
				grantDueThrough: new Date("2026-05-01T00:00:00.000Z"),
				remainingAfter: new Date("2026-05-01T00:00:00.000Z"),
				subscription: subscription(),
			},
			TX,
		);

		expect(result).toEqual({ fundingChargeIds: ["ch_old"], granted: 1 });
		expect(repository.cancelPendingSlotsForSubscription).toHaveBeenCalledWith(
			"sub_local",
			{ reason: "replaced", supersededByInvoiceId: "in_new" },
			TX,
		);
		expect(repository.insertRefillSlots).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					credits: 50_000,
					fundingChargeId: "ch_new",
					fundingInvoiceId: "in_new",
				}),
			]),
			TX,
		);
	});
});
