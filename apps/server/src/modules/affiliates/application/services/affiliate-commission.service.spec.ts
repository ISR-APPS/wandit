import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BillingCustomersRepository } from "../../../billing/infrastructure/persistence/billing-customers.repository";
import type { StripeProvider } from "../../../billing/infrastructure/stripe/stripe.provider";
import type {
	AffiliateAttributionRow,
	AffiliateCandidateRow,
	AffiliateCommissionRow,
	AffiliatesRepository,
	AffiliateTransaction,
} from "../../infrastructure/persistence/affiliates.repository";
import type { AffiliateClawbackService } from "./affiliate-clawback.service";
import { AffiliateCommissionService } from "./affiliate-commission.service";

const transaction = {} as AffiliateTransaction;
const paidAt = new Date("2026-02-01T00:00:00.000Z");

function attribution(
	overrides: Partial<AffiliateAttributionRow> = {},
): AffiliateAttributionRow {
	return {
		affiliateId: "11111111-1111-4111-8111-111111111111",
		clickedAt: new Date("2026-01-01T00:00:00.000Z"),
		commissionDurationMonths: 12,
		commissionRateBps: 2_500,
		createdAt: new Date("2026-01-02T00:00:00.000Z"),
		fixedAmountCents: null,
		fixedCurrency: null,
		fraudFlags: [],
		id: "22222222-2222-4222-8222-222222222222",
		linkId: "33333333-3333-4333-8333-333333333333",
		lockedAt: new Date("2026-01-02T00:00:00.000Z"),
		programId: "44444444-4444-4444-8444-444444444444",
		programKind: "percentage_recurring",
		source: "signup_cookie",
		status: "active",
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
		userId: "user_1",
		...overrides,
	};
}

function invoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
	return {
		amount_paid: 1_000,
		billing_reason: "subscription_cycle",
		created: Math.floor(paidAt.getTime() / 1_000),
		currency: "usd",
		customer: "cus_1",
		id: "in_1",
		payments: {
			data: [
				{
					payment: { charge: "ch_1", payment_intent: null },
					status: "paid",
				},
			],
			has_more: false,
		},
		status_transitions: {
			paid_at: Math.floor(paidAt.getTime() / 1_000),
		},
		total_excluding_tax: 800,
		...overrides,
	} as unknown as Stripe.Invoice;
}

class FakeAffiliatesRepository {
	readonly calls: string[] = [];
	attribution: AffiliateAttributionRow | null = attribution();
	candidateStatus: AffiliateCandidateRow["status"] = "pending_attribution";
	hasFixedEarning = false;
	insertedEarning: Record<string, unknown> | null = null;
	existingInvoiceEarning: AffiliateCommissionRow | null = null;

	withInvoiceLock = async <T>(
		_invoiceId: string,
		operation: (tx: AffiliateTransaction) => Promise<T>,
	) => operation(transaction);

	upsertCandidate = vi.fn(async (input: Record<string, unknown>) => {
		this.calls.push("candidate");
		return {
			...input,
			createdAt: paidAt,
			id: "55555555-5555-4555-8555-555555555555",
			status: this.candidateStatus,
			updatedAt: paidAt,
		} as AffiliateCandidateRow;
	});

	setCandidateStatus = vi.fn(
		async (_id: string, status: AffiliateCandidateRow["status"]) => {
			this.candidateStatus = status;
			if (status === "processed") {
				this.calls.push("candidate_processed");
			}
		},
	);
	lockCandidateByInvoiceId = vi.fn(
		async () =>
			({
				createdAt: paidAt,
				baseAmountCents: 800,
				billingReason: "subscription_cycle",
				currency: "usd",
				id: "55555555-5555-4555-8555-555555555555",
				paidAt,
				status: this.candidateStatus,
				stripeInvoiceId: "in_1",
				updatedAt: paidAt,
				userId: "user_1",
			}) as AffiliateCandidateRow,
	);

	lockAttributionByUserId = vi.fn(
		async (_userId: string, _tx: AffiliateTransaction) => {
			this.calls.push("attribution");
			return this.attribution;
		},
	);

	hasEarningForAttribution = vi.fn(async () => this.hasFixedEarning);
	holdDaysForAttribution = vi.fn(async () => 30);

	insertEarning = vi.fn(async (input: Record<string, unknown>) => {
		this.calls.push("earning");
		this.insertedEarning = input;
		return {
			...input,
			createdAt: paidAt,
			entryType: "earning",
			id: "66666666-6666-4666-8666-666666666666",
			originalCommissionId: null,
			payoutId: null,
			reversalReason: null,
			status: "pending",
			stripeDisputeId: null,
			stripeRefundId: null,
			updatedAt: paidAt,
		} as AffiliateCommissionRow;
	});

	findEarningByInvoiceId = vi.fn(async () => this.existingInvoiceEarning);

	listPendingCandidatesForUser = vi.fn(async () => []);
	listPendingAttributedCandidateUserIds = vi.fn(
		async (): Promise<string[]> => [],
	);
}

function setup(freshInvoice = invoice()) {
	const repository = new FakeAffiliatesRepository();
	const customers = {
		findByProviderCustomerId: vi.fn(async () => ({ userId: "user_1" })),
	};
	const stripe = {
		listInvoicePayments: vi.fn(async () => freshInvoice.payments?.data ?? []),
		retrieveInvoice: vi.fn(async () => freshInvoice),
		retrievePaymentIntent: vi.fn(),
	};
	const clawbacks = {
		reconcileInvoiceAfterEarning: vi.fn(async () => true),
	};
	const service = new AffiliateCommissionService(
		repository as unknown as AffiliatesRepository,
		customers as unknown as BillingCustomersRepository,
		{ findByProviderCustomerId: async () => null } as never,
		stripe as unknown as StripeProvider,
		clawbacks as unknown as AffiliateClawbackService,
	);

	return { clawbacks, customers, repository, service, stripe };
}

describe("AffiliateCommissionService", () => {
	beforeEach(() => vi.restoreAllMocks());

	it("ignores non-whitelisted billing reasons without writing a candidate", async () => {
		const event = invoice({ billing_reason: "manual" });
		const { repository, service, stripe } = setup(event);

		await expect(service.handlePaidInvoice(event)).resolves.toBe(false);
		expect(stripe.retrieveInvoice).not.toHaveBeenCalled();
		expect(repository.upsertCandidate).not.toHaveBeenCalled();
	});

	it("writes the candidate before attribution and uses the conservative tax/credit base", async () => {
		const { clawbacks, repository, service } = setup(
			invoice({ amount_paid: 700, total_excluding_tax: 900 }),
		);

		await expect(service.handlePaidInvoice(invoice())).resolves.toBe(true);

		expect(repository.calls).toEqual([
			"candidate",
			"attribution",
			"earning",
			"candidate_processed",
		]);
		expect(repository.upsertCandidate).toHaveBeenCalledWith(
			expect.objectContaining({ baseAmountCents: 700 }),
			transaction,
		);
		expect(repository.insertedEarning).toEqual(
			expect.objectContaining({ amountCents: 175, baseAmountCents: 700 }),
		);
		expect(clawbacks.reconcileInvoiceAfterEarning).toHaveBeenCalledWith(
			"in_1",
			transaction,
		);
		const reconcileOrder =
			clawbacks.reconcileInvoiceAfterEarning.mock.invocationCallOrder[0] ?? 0;
		const processedCallIndex =
			repository.setCandidateStatus.mock.calls.findIndex(
				(call) => call[1] === "processed",
			);
		const processedOrder =
			repository.setCandidateStatus.mock.invocationCallOrder[
				processedCallIndex
			] ?? 0;
		expect(reconcileOrder).toBeGreaterThan(0);
		expect(processedOrder).toBeGreaterThan(0);
		expect(reconcileOrder).toBeLessThan(processedOrder);
	});

	it("marks a zero invoice ineligible without requiring a funding charge", async () => {
		const { repository, service } = setup(
			invoice({ amount_paid: 0, payments: { data: [] } as never }),
		);

		await expect(service.handlePaidInvoice(invoice())).resolves.toBe(false);
		expect(repository.setCandidateStatus).toHaveBeenCalledWith(
			"55555555-5555-4555-8555-555555555555",
			"ineligible",
			transaction,
		);
		expect(repository.lockAttributionByUserId).not.toHaveBeenCalled();
	});

	it("persists an unattributed candidate without requiring a funding charge", async () => {
		const { repository, service, stripe } = setup(
			invoice({ payments: { data: [] } as never }),
		);
		repository.attribution = null;

		await expect(service.handlePaidInvoice(invoice())).resolves.toBe(false);

		expect(repository.upsertCandidate).toHaveBeenCalledOnce();
		expect(repository.lockAttributionByUserId).toHaveBeenCalledOnce();
		expect(stripe.retrievePaymentIntent).not.toHaveBeenCalled();
		expect(repository.insertEarning).not.toHaveBeenCalled();
	});

	it("loads the full paid-payment list when Stripe's embedded page is truncated", async () => {
		const truncated = invoice({
			payments: {
				data: [],
				has_more: true,
			} as never,
		});
		const { repository, service, stripe } = setup(truncated);
		stripe.listInvoicePayments.mockResolvedValueOnce(
			invoice().payments?.data ?? [],
		);

		await expect(service.handlePaidInvoice(invoice())).resolves.toBe(true);

		expect(stripe.listInvoicePayments).toHaveBeenCalledWith("in_1");
		expect(repository.insertedEarning).toEqual(
			expect.objectContaining({ stripeChargeId: "ch_1" }),
		);
	});

	it("rejects a paid invoice without Stripe's authoritative paid timestamp", async () => {
		const { repository, service } = setup(
			invoice({ status_transitions: { paid_at: null } as never }),
		);

		await expect(service.handlePaidInvoice(invoice())).rejects.toThrow(
			"Stripe paid invoice in_1 has no valid paid_at timestamp",
		);
		expect(repository.upsertCandidate).not.toHaveBeenCalled();
	});

	it("keeps a candidate pending when fresh charge reconciliation fails", async () => {
		const { clawbacks, repository, service } = setup();
		clawbacks.reconcileInvoiceAfterEarning.mockRejectedValueOnce(
			new Error("Stripe unavailable"),
		);

		await expect(service.handlePaidInvoice(invoice())).rejects.toThrow(
			"Stripe unavailable",
		);
		expect(repository.candidateStatus).toBe("pending_attribution");
		expect(repository.calls).not.toContain("candidate_processed");
	});

	it("keeps a candidate pending when its earning cannot be reconciled", async () => {
		const { clawbacks, repository, service } = setup();
		clawbacks.reconcileInvoiceAfterEarning.mockResolvedValueOnce(false);

		await expect(service.handlePaidInvoice(invoice())).rejects.toThrow(
			"Affiliate earning in_1 disappeared before reconciliation",
		);
		expect(repository.candidateStatus).toBe("pending_attribution");
		expect(repository.calls).not.toContain("candidate_processed");
	});

	it("does not rerun Stripe reconciliation for an already processed replay", async () => {
		const { clawbacks, repository, service } = setup();
		repository.candidateStatus = "processed";

		await expect(service.handlePaidInvoice(invoice())).resolves.toBe(true);

		expect(clawbacks.reconcileInvoiceAfterEarning).not.toHaveBeenCalled();
		expect(repository.lockCandidateByInvoiceId).toHaveBeenCalledWith(
			"in_1",
			transaction,
		);
		expect(repository.setCandidateStatus).not.toHaveBeenCalled();
	});

	it("sweeps durable pending candidates that now have attributions", async () => {
		const { repository, service } = setup();
		repository.listPendingAttributedCandidateUserIds.mockResolvedValueOnce([
			"user_1",
			"user_2",
		]);
		vi.spyOn(service, "reconcileCandidatesForUser")
			.mockResolvedValueOnce(2)
			.mockResolvedValueOnce(1);

		await expect(service.reconcilePendingAttributedCandidates()).resolves.toBe(
			3,
		);
		expect(service.reconcileCandidatesForUser).toHaveBeenCalledTimes(2);
	});

	it("honors the half-open duration boundary", async () => {
		const boundary = new Date("2026-02-01T00:00:00.000Z");
		const { repository, service } = setup(invoice());
		repository.attribution = attribution({
			commissionDurationMonths: 1,
			lockedAt: new Date("2026-01-01T00:00:00.000Z"),
		});

		await expect(service.handlePaidInvoice(invoice())).resolves.toBe(false);
		expect(boundary).toEqual(paidAt);
		expect(repository.setCandidateStatus).toHaveBeenCalledWith(
			expect.any(String),
			"ineligible",
			transaction,
		);
	});

	it("allows checkout-before-signup reconciliation when payment follows the click", async () => {
		const { repository, service } = setup(invoice());
		repository.attribution = attribution({
			clickedAt: new Date("2026-01-31T23:00:00.000Z"),
			lockedAt: new Date("2026-02-01T01:00:00.000Z"),
		});

		await expect(service.handlePaidInvoice(invoice())).resolves.toBe(true);
		expect(repository.insertEarning).toHaveBeenCalledOnce();
	});

	it("serializes fixed one-time admission on the locked attribution row", async () => {
		const { repository, service } = setup(invoice());
		repository.attribution = attribution({
			commissionRateBps: null,
			fixedAmountCents: 5_000,
			fixedCurrency: "usd",
			programKind: "fixed_one_time",
		});
		repository.hasFixedEarning = true;

		await expect(service.handlePaidInvoice(invoice())).resolves.toBe(false);
		expect(repository.hasEarningForAttribution).toHaveBeenCalledWith(
			repository.attribution.id,
			transaction,
		);
		expect(repository.insertEarning).not.toHaveBeenCalled();
	});

	it("admits only one fixed earning when two invoice locks race", async () => {
		class RaceRepository extends FakeAffiliatesRepository {
			private lockTail: Promise<void> = Promise.resolve();
			private readonly releases = new Map<AffiliateTransaction, () => void>();
			private earned = false;
			readonly earningInvoiceIds: string[] = [];

			override withInvoiceLock = async <T>(
				_invoiceId: string,
				operation: (tx: AffiliateTransaction) => Promise<T>,
			) => {
				const tx = {} as AffiliateTransaction;

				try {
					return await operation(tx);
				} finally {
					this.releases.get(tx)?.();
				}
			};

			override lockAttributionByUserId = vi.fn(
				async (_userId: string, tx: AffiliateTransaction) => {
					const previous = this.lockTail;
					let release: () => void = () => undefined;
					this.lockTail = new Promise<void>((resolve) => {
						release = () => resolve();
					});
					this.releases.set(tx, release);
					await previous;
					return this.attribution;
				},
			);

			override hasEarningForAttribution = vi.fn(async () => this.earned);

			override insertEarning = vi.fn(async (input: Record<string, unknown>) => {
				this.earned = true;
				this.earningInvoiceIds.push(input.stripeInvoiceId as string);
				return {
					...input,
					createdAt: paidAt,
					entryType: "earning",
					id: "66666666-6666-4666-8666-666666666666",
					originalCommissionId: null,
					payoutId: null,
					reversalReason: null,
					status: "pending",
					stripeDisputeId: null,
					stripeRefundId: null,
					updatedAt: paidAt,
				} as AffiliateCommissionRow;
			});
		}

		const repository = new RaceRepository();
		repository.attribution = attribution({
			commissionRateBps: null,
			fixedAmountCents: 5_000,
			fixedCurrency: "usd",
			programKind: "fixed_one_time",
		});
		const stripe = {
			listInvoicePayments: vi.fn(async () => invoice().payments?.data ?? []),
			retrieveInvoice: vi.fn(async (id: string) => invoice({ id })),
			retrievePaymentIntent: vi.fn(),
		};
		const customers = {
			findByProviderCustomerId: vi.fn(async () => ({ userId: "user_1" })),
		};
		const clawbacks = {
			reconcileInvoiceAfterEarning: vi.fn(async () => true),
		};
		const service = new AffiliateCommissionService(
			repository as unknown as AffiliatesRepository,
			customers as unknown as BillingCustomersRepository,
			{ findByProviderCustomerId: async () => null } as never,
			stripe as unknown as StripeProvider,
			clawbacks as unknown as AffiliateClawbackService,
		);

		const outcomes = await Promise.all([
			service.handlePaidInvoice(invoice({ id: "in_race_1" })),
			service.handlePaidInvoice(invoice({ id: "in_race_2" })),
		]);

		expect(outcomes.sort()).toEqual([false, true]);
		expect(repository.earningInvoiceIds).toHaveLength(1);
	});
});
